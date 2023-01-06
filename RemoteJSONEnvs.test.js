"use strict";

const RemoteJSONEnvs = require("./RemoteJSONEnvs");
const Serverless = require("serverless/lib/serverless");
// const chalk = require('chalk')
const sinon = require("sinon");
const chai = require("chai");
const BbPromise = require("bluebird");
// const Serverless = require('serverless/lib/serverless')
const AwsProvider = require("serverless/lib/plugins/aws/provider");
// const ServerlessApigatewayServiceProxy = require('./index')
const ServerlessError = require("serverless/lib/serverless-error");

chai.use(require("chai-as-promised"));
chai.use(require("sinon-chai"));

const expect = chai.expect;

describe("RemoteJSONEnvs.js", () => {
  let serverless;
  let remoteJSONEnvs;

  beforeEach(() => {
    serverless = new Serverless({ commands: [], options: {} });
    serverless.servicePath = true;
    serverless.service.service = "Hello-world-lambda";
    serverless.configurationInput = {
      service: "hola-mundo",
      provider: {
        name: "aws",
        environment: { myjsonsecrets: "the-valueeee" },
      },
      custom: {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              SSMParameterStore: [
                {
                  key: "/staging/my/secret/one",
                  secretJSONKey: "secretos",
                },
              ],
            },
          },
        },
      },
      functions: {
        "hello-world": {
          handler: "handler.hello",
          name: "dev-hello-world",
        },
      },
    };
    serverless.cli = {
      consoleLog: () => {},
    };

    serverless.setProvider("aws", new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
    };
    remoteJSONEnvs = new RemoteJSONEnvs(serverless);
  });

  describe("constructor", () => {
    beforeEach(() => {
      serverless = new Serverless({ commands: [], options: {} });
      serverless.servicePath = true;
      serverless.service.service = "Hello-world-lambda";
      serverless.setProvider("aws", new AwsProvider(serverless));
      serverless.service.provider.compiledCloudFormationTemplate = {
        Resources: {},
      };
      remoteJSONEnvs = new RemoteJSONEnvs(serverless);
    });

    it("should asign serverless instance", () => {
      expect(remoteJSONEnvs.serverless).to.be.not.empty;
    });

    it("should have hooks", () => {
      expect(remoteJSONEnvs.hooks).to.be.not.empty;
    });

    it("should have package:compileEvents as hook", () => {
      sinon.stub(remoteJSONEnvs, "packageCompile").returns(BbPromise.resolve());
      remoteJSONEnvs.hooks["package:compileEvents"]();
      expect(Object.keys(remoteJSONEnvs.hooks)).to.contains(
        "package:compileEvents"
      );
    });
  });

  describe("packageCompile", () => {
    beforeEach(() => {
      serverless.configurationInput = {
        service: "hola-mundo",
        functions: {
          "hello-world": {
            handler: "handler.hello",
            name: "dev-hello-world",
          },
        },
      };
      serverless.service.provider.compiledCloudFormationTemplate = {
        Resources: {},
      };
    });

    it("should merge normal envs with json envs", async () => {
      serverless.service.provider.compiledCloudFormationTemplate.Resources = {
        HelloDashworldLambdaFunction: {
          Type: "AWS::Lambda::Function",
          Properties: {
            Environment: {
              Variables: { local: "localenv" },
            },
          },
        },
      };

      (serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              SSMParameterStore: [
                {
                  key: "/staging/my/secret/one",
                  secretJSONKey: "secretos",
                },
              ],
            },
          },
        },
      }),
        (remoteJSONEnvs = new RemoteJSONEnvs(serverless));

      sinon
        .stub(remoteJSONEnvs, "resolveSSM")
        .returns(
          BbPromise.resolve([
            { value: { secretos: { hello1: "mundo1", f2oo1: "bar1" } } },
            { value: { secrets: { hello2: "wordl2", foo2: "bar2to" } } },
            { value: null },
          ])
        );

      await expect(remoteJSONEnvs.packageCompile()).to.be.fulfilled.then(() => {
        expect(
          serverless.service.provider.compiledCloudFormationTemplate.Resources
            .HelloDashworldLambdaFunction.Properties.Environment.Variables
        ).to.deep.equal({ local: "localenv", hello1: "mundo1", f2oo1: "bar1" });
      });
    });

    it("should use only normal envs", async () => {
      serverless.service.provider.compiledCloudFormationTemplate.Resources = {
        HelloDashworldLambdaFunction: {
          Type: "AWS::Lambda::Function",
          Properties: {
            Environment: {
              Variables: { local: "localenv" },
            },
          },
        },
      };

      (serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              SSMParameterStore: [
                {
                  key: "/staging/my/secret/one",
                  secretJSONKey: "secretos",
                },
              ],
            },
          },
        },
      }),
        (remoteJSONEnvs = new RemoteJSONEnvs(serverless));

      sinon
        .stub(remoteJSONEnvs, "resolveSSM")
        .returns(BbPromise.resolve([{ value: null }]));

      await expect(remoteJSONEnvs.packageCompile()).to.be.fulfilled.then(() => {
        expect(
          serverless.service.provider.compiledCloudFormationTemplate.Resources
            .HelloDashworldLambdaFunction.Properties.Environment.Variables
        ).to.deep.equal({ local: "localenv" });
      });
    });

    it("should use only json envs", async () => {
      serverless.service.provider.compiledCloudFormationTemplate.Resources = {
        HelloDashworldLambdaFunction: {
          Type: "AWS::Lambda::Function",
          Properties: {
            Environment: {
              Variables: {},
            },
          },
        },
      };

      (serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              SSMParameterStore: [
                {
                  key: "/staging/my/secret/one",
                  secretJSONKey: "secretos",
                },
              ],
            },
          },
        },
      }),
        (remoteJSONEnvs = new RemoteJSONEnvs(serverless));

      sinon
        .stub(remoteJSONEnvs, "resolveSSM")
        .returns(
          BbPromise.resolve([
            { value: { secretos: { hello1: "mundo1", f2oo1: "bar1" } } },
            { value: { secrets: { hello2: "wordl2", foo2: "bar2to" } } },
            { value: null },
          ])
        );

      await expect(remoteJSONEnvs.packageCompile()).to.be.fulfilled.then(() => {
        expect(
          serverless.service.provider.compiledCloudFormationTemplate.Resources
            .HelloDashworldLambdaFunction.Properties.Environment.Variables
        ).to.deep.equal({ hello1: "mundo1", f2oo1: "bar1" });
      });
    });

    it("shouldnt add envs", async () => {
      serverless.service.provider.compiledCloudFormationTemplate.Resources = {
        HelloDashworldLambdaFunction: {
          Type: "AWS::Lambda::Function",
          Properties: {
            Environment: {
              Variables: {},
            },
          },
        },
      };

      (serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              SSMParameterStore: [
                {
                  key: "/staging/my/secret/one",
                  secretJSONKey: "secretoas",
                },
              ],
            },
          },
        },
      }),
        (remoteJSONEnvs = new RemoteJSONEnvs(serverless));

      sinon
        .stub(remoteJSONEnvs, "resolveSSM")
        .returns(
          BbPromise.resolve([
            { value: { secretos: { hello1: "mundo1", f2oo1: "bar1" } } },
            { value: { secrets: { hello2: "wordl2", foo2: "bar2to" } } },
            { value: null },
          ])
        );

      await expect(remoteJSONEnvs.packageCompile()).to.be.fulfilled.then(() => {
        expect(
          serverless.service.provider.compiledCloudFormationTemplate.Resources
            .HelloDashworldLambdaFunction.Properties.Environment.Variables
        ).to.deep.equal({});
      });
    });
  });

  describe("resolveSSM", () => {
    beforeEach(() => {
      serverless = new Serverless({ commands: [], options: {} });
      serverless.servicePath = true;
      serverless.service.service = "Hello-world-lambda";
      serverless.configurationInput = {
        service: "hola-mundo",
        provider: {
          name: "aws",
          environment: { myjsonsecrets: "the-valueeee" },
          profile: "x",
        },
        custom: {
          RemoteJSONEnvs: {
            provider: {
              aws: {
                SSMParameterStore: [
                  {
                    key: "/staging/my/secret/one",
                    secretJSONKey: "secretos",
                  },
                ],
              },
            },
          },
        },
        functions: {
          "hello-world": {
            handler: "handler.hello",
            name: "dev-hello-world",
          },
        },
      };
      serverless.cli = {
        consoleLog: () => {},
      };
      serverless.setProvider("aws", new AwsProvider(serverless));
      remoteJSONEnvs = new RemoteJSONEnvs(serverless);
      remoteJSONEnvs.storeConfig = {
        provider: "SSMParameterStore",
        keys: [
          { key: "/staging/my/secret/one", secretJSONKey: "secretos" },
          { key: "/staging/my/secret/two", secretJSONKey: "secrets" },
          { key: "/staging/my/secret/threea", secretJSONKey: "secrets" },
        ],
      };
    });

    it("should resolve all promises related with ssm", async () => {
      const results = await remoteJSONEnvs.resolveSSM({
        resolve: () => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve("foo");
            }, 300);
          });
        },
      });
      expect(results).to.be.not.empty;
    });

    it("should resolve with error promises related with ssm", () => {
      expect(
        remoteJSONEnvs.resolveSSM({
          resolve: () => {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                reject("a");
              }, 300);
            });
          },
        })
      ).eventually.rejectedWith(ServerlessError);
    });
  });

  describe("getRemoteJSONEnvsConfig", () => {
    beforeEach(() => {
      serverless = new Serverless({ commands: [], options: {} });
      serverless.servicePath = true;
      serverless.service.service = "Hello-world-lambda";
      serverless.configurationInput = {
        service: "hola-mundo",
        functions: {
          "hello-world": {
            handler: "handler.hello",
            name: "dev-hello-world",
          },
        },
      };
      serverless.cli = {
        consoleLog: () => {},
      };
      serverless.setProvider("aws", new AwsProvider(serverless));
      remoteJSONEnvs = new RemoteJSONEnvs(serverless);
      remoteJSONEnvs.storeConfig = {
        provider: "SSMParameterStore",
        keys: [
          { key: "/staging/my/secret/one", secretJSONKey: "secretos" },
          { key: "/staging/my/secret/two", secretJSONKey: "secrets" },
          { key: "/staging/my/secret/threea", secretJSONKey: "secrets" },
        ],
      };
    });

    it("should do nothing if not custom config", () => {
      remoteJSONEnvs.getRemoteJSONEnvsConfig(serverless.configurationInput);
    });

    it("should return error if provider its not asigned provider", () => {
      serverless.configurationInput.custom = {
        RemoteJSONEnvs: {},
      };
      expect(() =>
        remoteJSONEnvs.getRemoteJSONEnvsConfig(serverless.configurationInput)
      ).to.throws(ServerlessError);
    });
  });

  describe("getRemoteJSONEnvsProvider", () => {
    beforeEach(() => {
      serverless = new Serverless({ commands: [], options: {} });
      serverless.servicePath = true;
      serverless.service.service = "Hello-world-lambda";
      serverless.configurationInput = {
        service: "hola-mundo",
        functions: {
          "hello-world": {
            handler: "handler.hello",
            name: "dev-hello-world",
          },
        },
      };
      serverless.cli = {
        consoleLog: () => {},
      };
      serverless.setProvider("aws", new AwsProvider(serverless));
      remoteJSONEnvs = new RemoteJSONEnvs(serverless);
      remoteJSONEnvs.storeConfig = {
        provider: "SSMParameterStore",
        keys: [
          { key: "/staging/my/secret/one", secretJSONKey: "secretos" },
          { key: "/staging/my/secret/two", secretJSONKey: "secrets" },
          { key: "/staging/my/secret/threea", secretJSONKey: "secrets" },
        ],
      };
    });

    it("should return error if not SSMParameterStore", () => {
      serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              s4: "hehe",
            },
          },
        },
      };
      expect(() =>
        remoteJSONEnvs.getRemoteJSONEnvsProvider(serverless.configurationInput)
      ).to.throws(ServerlessError);
    });

    it("should return error S3", () => {
      serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              S3: "hehe",
            },
          },
        },
      };
      expect(() =>
        remoteJSONEnvs.getRemoteJSONEnvsProvider(serverless.configurationInput)
      ).to.throws(ServerlessError);
    });

    it("should return error if not awsconfig", () => {
      serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              SSMParameterStore: null,
            },
          },
        },
      };
      expect(() =>
        remoteJSONEnvs.getRemoteJSONEnvsProvider(serverless.configurationInput)
      ).to.throws(ServerlessError);
    });

    it("should return error if not list as awsconfig", () => {
      serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              SSMParameterStore: { hehe: "pain" },
            },
          },
        },
      };
      expect(() =>
        remoteJSONEnvs.getRemoteJSONEnvsProvider(serverless.configurationInput)
      ).to.throws(ServerlessError);
    });

    it("should return error if not key as awsconfig list", () => {
      serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              SSMParameterStore: [{}],
            },
          },
        },
      };
      expect(() =>
        remoteJSONEnvs.getRemoteJSONEnvsProvider(serverless.configurationInput)
      ).to.throws(ServerlessError);
    });

    it("should return error if not key as awsconfig list", () => {
      serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            aws: {
              SSMParameterStore: [{ key: 1 }],
            },
          },
        },
      };
      expect(() =>
        remoteJSONEnvs.getRemoteJSONEnvsProvider(serverless.configurationInput)
      ).to.throws(ServerlessError);
    });

    it("should return error if not aws provider", () => {
      serverless.configurationInput.custom = {
        RemoteJSONEnvs: {
          provider: {
            azure: {
              SSMParameterStore: [{ key: 1 }],
            },
          },
        },
      };
      expect(() =>
        remoteJSONEnvs.getRemoteJSONEnvsProvider(serverless.configurationInput)
      ).to.throws(ServerlessError);
    });
  });
});
