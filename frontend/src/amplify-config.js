import { Amplify } from 'aws-amplify';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'eu-central-1_ZpQH8Tpm4',
      userPoolClientId: '1ru136enta8u093mc04772q6a8',
      region: 'eu-central-1',
      loginWith: {
        email: true,
        username: false
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true
        }
      },
      allowGuestAccess: false,
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: false
      }
    }
  }
};

Amplify.configure(amplifyConfig);

export default amplifyConfig;
