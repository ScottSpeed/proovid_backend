import { Amplify } from 'aws-amplify';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'eu-central-1_ZpQH8Tpm4',
      userPoolClientId: '1ru136enta8u093mc04772q6a8',
    }
  }
};

Amplify.configure(amplifyConfig);

export default amplifyConfig;