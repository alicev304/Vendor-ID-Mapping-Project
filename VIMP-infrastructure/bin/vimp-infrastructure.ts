#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VimpInfrastructureStack } from '../lib/vimp-infrastructure-stack';

const app = new cdk.App();
new VimpInfrastructureStack(app, 'VimpInfrastructureStack');
