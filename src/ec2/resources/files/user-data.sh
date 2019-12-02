#!/bin/bash -xe

# runs the CloudFormation::Init
/opt/aws/bin/cfn-init -v --stack ${AWS::StackName} --resource Instance --region ${AWS::Region}
