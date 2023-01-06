"use strict";
const ssm = require("serverless/lib/configuration/variables/sources/instance-dependent/get-ssm");
const ServerlessError = require("serverless/lib/serverless-error");

class RemoteJSONEnvs {
  constructor(serverless) {
    this.serverless = serverless;
    this.hooks = {
      "package:compileEvents": () => this.packageCompile(),
    };
    this.ssm = ssm;
  }

  async packageCompile() {
    this.storeConfig = this.getRemoteJSONEnvsConfig(
      this.serverless.configurationInput
    );
    const secretValues = await this.resolveSSM();
    const valuesWithMetadata = this.extractSecrets(secretValues);
    const mergedSecrets = this.mergeSecrets(valuesWithMetadata);
    this.mergeVariables(mergedSecrets);
    console.log(
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources
        .HelloDashworldLambdaFunction.Properties.Environment
    );
  }

  mergeVariables(mergedSecrets) {
    let currentVariables;
    Object.keys(
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources
    ).forEach((lambda) => {
      if (
        this.serverless.service.provider.compiledCloudFormationTemplate
          .Resources[lambda]["Type"] === "AWS::Lambda::Function"
      ) {
        currentVariables =
          this.serverless.service.provider.compiledCloudFormationTemplate
            .Resources[lambda].Properties.Environment.Variables;
        this.serverless.service.provider.compiledCloudFormationTemplate.Resources[
          lambda
        ].Properties.Environment.Variables = {
          ...currentVariables,
          ...mergedSecrets,
        };
      }
    });
  }

  mergeSecrets(valuesWithMetadata) {
    let merge = {};
    valuesWithMetadata.forEach((value) => {
      merge = { ...merge, ...value.value };
    });
    return merge;
  }

  extractSecrets(values) {
    const valuesWithMetadata = this.storeConfig.keys.map((key, index) => {
      if (values[index].value == null) {
        this.serverless.cli.consoleLog(
          `RemoteJSONEnvsPlugin Warning: "${key.key}" key not found`
        );
        return {};
      }
      key.value = values[index].value[`${key.secretJSONKey}`];
      if (!values[index].value[`${key.secretJSONKey}`])
        this.serverless.cli.consoleLog(
          `RemoteJSONEnvsPlugin Warning: "${key.secretJSONKey}" its not a valid secretJSONKey for ${key.key} value`
        );
      return key;
    });
    return valuesWithMetadata;
  }

  resolveSSM(resolver) {
    let SSMResolver = ssm(this.serverless);
    if (resolver) SSMResolver = resolver;
    const toResolve = this.storeConfig.keys.map((key) => {
      return SSMResolver.resolve({ address: key.key });
    });
    return Promise.all(toResolve)
      .then((results) => results)
      .catch((e) => {
        throw new ServerlessError(e);
      });
  }

  getRemoteJSONEnvsConfig(configurationInput) {
    if (!configurationInput.custom || !configurationInput.custom.RemoteJSONEnvs)
      return;
    if (!configurationInput.custom.RemoteJSONEnvs.provider) {
      throw new ServerlessError(`RemoteJSONEnvs Provider its not defined`);
    }

    const RemoteJSONEnvsProvider =
      this.getRemoteJSONEnvsProvider(configurationInput);
    return RemoteJSONEnvsProvider;
  }

  getRemoteJSONEnvsProvider(configurationInput) {
    switch (Object.keys(configurationInput.custom.RemoteJSONEnvs.provider)[0]) {
      case "aws":
        const AWSConfig = configurationInput.custom.RemoteJSONEnvs.provider.aws;
        if (
          Object.keys(AWSConfig)[0] != "SSMParameterStore" &&
          Object.keys(AWSConfig)[0] != "S3"
        )
          throw new ServerlessError(
            `RemoteJSONEnvsPlugin AWS Provider its not correctly configured, SSMParameterStore or S3 are supported`
          );
        if (Object.keys(AWSConfig)[0] == "S3")
          throw new ServerlessError(
            `RemoteJSONEnvsPlugin AWS S3 its not ready yet`
          );
        const AWSSSMConfig =
          configurationInput.custom.RemoteJSONEnvs.provider.aws[
            `${Object.keys(AWSConfig)[0]}`
          ];
        if (!AWSSSMConfig)
          throw new ServerlessError(
            `RemoteJSONEnvs Provider aws its not configured`
          );
        if (typeof AWSSSMConfig != "object" || !Array.isArray(AWSSSMConfig)) {
          throw new ServerlessError(
            `RemoteJSONEnvs Provider AWS ${
              Object.keys(AWSConfig)[0]
            } its not an array object`
          );
        }
        AWSSSMConfig.forEach((element) => {
          if (!element.key)
            throw new ServerlessError(
              `RemoteJSONEnvs Provider aws-ssm array must contain a key`
            );
          if (typeof element.key != "string")
            throw new ServerlessError(
              `RemoteJSONEnvs Provider aws-ssm keys are not strings: ${element.key}`
            );
        });
        return {
          provider: Object.keys(AWSConfig)[0],
          keys: AWSSSMConfig,
        };
      default:
        throw new ServerlessError(
          `Provider ${
            Object.keys(configurationInput.custom.RemoteJSONEnvs.provider)[0]
          } its not defined`
        );
    }
  }
}

module.exports = RemoteJSONEnvs;
