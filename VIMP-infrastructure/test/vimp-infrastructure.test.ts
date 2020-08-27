import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as VimpInfrastructure from '../lib/vimp-infrastructure-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new VimpInfrastructure.VimpInfrastructureStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
