const fs = require('fs');

const userData = fs.readFileSync(`${__dirname}/../files/user-data.sh`, 'utf-8');
const awscliConf = fs.readFileSync(`${__dirname}/../files/awscli.conf`, 'utf-8');
const awslogsConf = fs.readFileSync(`${__dirname}/../files/awslogs.conf`, 'utf-8');
const cfnHupConf = fs.readFileSync(`${__dirname}/../files/cfn-hup.conf`, 'utf-8');
const cfnAutoReloaderConf = fs.readFileSync(`${__dirname}/../files/cfn-auto-reloader.conf`, 'utf-8');

module.exports = {
  InstanceProfile: {
    Type: 'AWS::IAM::InstanceProfile',
    Properties: {
      Roles: [
        {
          Ref: 'InstanceIamLogRole',
        },
      ],
    },
  },
  Instance: {
    Type: 'AWS::EC2::Instance',
    Metadata: {
      'AWS::CloudFormation::Init': {
        configSets: {
          default: ['init', 'install', 'setupLogs', 'setupApp'],
        },
        init: {
          commands: {
            aYumUpdate: {
              command: 'yum update -y',
              cwd: '~',
            },
            bGrabNode: {
              command: 'curl -sL https://rpm.nodesource.com/setup_10.x | bash -',
              cwd: '~',
            },
            cMakeAppDir: {
              command: 'mkdir -p /home/ec2-user/app',
              cwd: '~',
            },
          },
          files: {
            '/etc/cfn/cfn-hup.conf': {
              content: {
                'Fn::Sub': cfnHupConf,
              },
              mode: '000400',
              owner: 'root',
              group: 'root',
            },
            '/etc/cfn/hooks.d/cfn-auto-reloader.conf': {
              content: {
                'Fn::Sub': cfnAutoReloaderConf,
              },
            },
          },
          services: {
            sysvinit: {
              'cfn-hup': {
                enabled: true,
                ensureRunning: true,
                files: [
                  '/etc/cfn/cfn-hup.conf',
                  '/etc/cfn/hooks.d/cfn-auto-reloader.conf',
                ],
              },
            },
          },
        },
        install: {
          packages: {
            yum: {
              git: [],
              nodejs: [],
              awslogs: [],
            },
          },
        },
        setupLogs: {
          files: {
            '/etc/awslogs/awscli.conf': {
              content: {
                'Fn::Sub': awscliConf,
              },
              mode: '000644',
              owner: 'root',
              group: 'root',
            },
            '/etc/awslogs/awslogs.conf': {
              content: {
                'Fn::Sub': awslogsConf,
              },
              mode: '000644',
              owner: 'root',
              group: 'root',
            },
            '/var/log/nodejs.log': {
              content: '[Nodejs Logs]\n',
              mode: '000644',
              owner: 'ec2-user',
              group: 'ec2-user',
            },
            '/var/log/nodejserr.log': {
              content: '[Nodejs Error Logs]\n',
              mode: '000644',
              owner: 'ec2-user',
              group: 'ec2-user',
            },
          },
          services: {
            sysvinit: {
              awslogsd: {
                enabled: true,
                ensureRunning: true,
                files: [
                  '/etc/awslogs/awscli.conf',
                  '/etc/awslogs/awslogs.conf',
                ],
              },
            },
          },
        },
        setupApp: {
          commands: {
            aCloneRepo: {
              command: 'git clone https://github.com/jcolemorrison/ec2-lb-api.git .',
              cwd: '/home/ec2-user/app',
            },
            bInstallNpmPackages: {
              command: 'npm install',
              cwd: '/home/ec2-user/app',
            },
            cFirewall: {
              command: 'iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000',
              cwd: '~',
            },
            dStartServer: {
              command: 'su ec2-user -c "node . > /var/log/nodejs.log 2> /var/log/nodejserr.log"',
              cwd: '/home/ec2-user/app',
            },
          },
        },
      },
    },
    Properties: {
      ImageId: {
        Ref: 'ParamAmiId',
      },
      InstanceType: {
        Ref: 'ParamInstanceType',
      },
      KeyName: { Ref: 'ParamEC2KeyPair' },
      SecurityGroupIds: [
        {
          'Fn::ImportValue': {
            // eslint-disable-next-line no-template-curly-in-string
            'Fn::Sub': '${ParamSecurityStackName}-SecurityGroupId',
          },
        },
      ],
      SubnetId: {
        'Fn::ImportValue': {
          // eslint-disable-next-line no-template-curly-in-string
          'Fn::Sub': '${ParamNetworkStackName}-PublicSubnetA',
        },
      },
      UserData: { 'Fn::Base64': { 'Fn::Sub': userData } },
      IamInstanceProfile: { Ref: 'InstanceProfile' },
      Tags: [
        {
          Key: 'Name',
          Value: {
            // eslint-disable-next-line no-template-curly-in-string
            'Fn::Sub': '${AWS::StackName}-nodejs',
          },
        },
        {
          Key: 'Owner',
          Value: { Ref: 'ParamAuthorName' },
        },
      ],
    },
  },
};
