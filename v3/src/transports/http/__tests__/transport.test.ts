import { processHttpRequest, IHttpResponse } from '../transport';
import { gql } from '../../..';
// TODO(AS3) Stop depending on this module!
import { buildSchemaFromSDL } from "apollo-graphql";
import { GraphQLSchema } from "graphql/type/schema";
// TODO(AS3) Stop depending on this module!
import { ForbiddenError } from "apollo-server-core";
import { GraphQLRequest } from "../../../types";

const testModule = {
  typeDefs: gql`
    type Book {
      title: String
      author: String
    }

    type Query {
      books: [Book]
      throwForbiddenError: String
    }
  `,
  resolvers: {
    Query: {
      books: () => [
        {
          title: "Harry Potter and the Chamber of Secrets",
          author: "J.K. Rowling"
        },
        {
          title: "Jurassic Park",
          author: "Michael Crichton"
        },
      ],
      throwForbiddenError() {
        // TODO(AS3) What should we do with these?
        throw new ForbiddenError("Not allowed!");
      },
    },
  },
};

const validQuery= "query { books { author } }";
const unparseableQuery = "query {";
const invalidQuery = "query { books }";

/**
 * Test helper which simulates an HTTP POST (simulates because we're only ever
 * emulating the interface, not actually doing it over a socket) `query` on a
 * GraphQL schema.
 */
async function httpPostGraphqlQueryToSchema(
  schema: GraphQLSchema,
  query: GraphQLRequest["query"],
  variables: GraphQLRequest["variables"] = Object.create(null),
  headers: Record<string, any> = Object.create(null),
): Promise<IHttpResponse> {
  return processHttpRequest({
    schema,
    request: {
      method: "POST",
      headers,
      parsedRequest: {
        query,
        variables,
      },
    },
  });
}

describe("processes an HTTP request", () => {
  const schema = buildSchemaFromSDL([testModule]);

  describe("Status code", () => {
    it("is set to 200 on a single, properly formed query", async () => {
      expect.assertions(1);
      await expect(
        httpPostGraphqlQueryToSchema(schema, validQuery),
      ).resolves.toHaveProperty("statusCode", 200);
    });

    it("returns a 400 error code on a GraphQL parse error", async () => {
      expect.assertions(1);
      await expect(
        httpPostGraphqlQueryToSchema(schema, unparseableQuery),
      ).resolves.toHaveProperty("statusCode", 400);
    });

    it("returns a 400 error code on a GraphQL validation error", async () => {
      expect.assertions(1);
      await expect(
        httpPostGraphqlQueryToSchema(schema, invalidQuery),
      ).resolves.toHaveProperty("statusCode", 400);
    });

    it("returns a 207 code on a forbidden error in a resolver", async () => {
      expect.assertions(1);
      await expect(
        httpPostGraphqlQueryToSchema(schema, "query { throwForbiddenError }"),
      ).resolves.toHaveProperty("statusCode", 207);
    });

    it.todo("returns a 405 if the HTTP method was not 'POST' or 'GET'");

    /**
     * To implement this test, we need cooperation from the request pipeline.
     * Today, this would be done with `didResolveOperation`.
     */
    it.todo("returns a 405 when attempting a 'mutation' when the 'GET' method is used");
    it.todo("returns a 400 when 'variables' is malformed");

    it.todo("ensure that 'extensions' are properly returned in the response");
    it.todo("ensure that 'errors' is properly returned in the response");
    it.todo("ensure that 'data' is properly returned in the response");
  });

  describe("Headers", () => {
    describe("`Content-type`", () => {
      expect.assertions(1);
      it("is set to `application/json` on a single, properly formed query",
        async () => {
          await expect(
            httpPostGraphqlQueryToSchema(schema, validQuery),
          ).resolves.toHaveProperty(
            ["headers", "content-type"],
            "application/json",
          );
        }
      );

      it("is set to `application/json` on an request that doesn't parse",
        async () => {
          await expect(
            httpPostGraphqlQueryToSchema(schema, unparseableQuery),
          ).resolves.toHaveProperty(
            ["headers", "content-type"],
            "application/json",
          );
        }
      );

      it("is set to `application/json` on an request that doesn't validate",
        async () => {
          await expect(
            httpPostGraphqlQueryToSchema(schema, invalidQuery),
          ).resolves.toHaveProperty(
            ["headers", "content-type"],
            "application/json",
          );
        }
      );

      it("is set to `application/json` on an execution error", async () => {
        expect.assertions(1);
        await expect(
          httpPostGraphqlQueryToSchema(schema, "query { throwForbiddenError }"),
        ).resolves.toHaveProperty(
          ["headers", "content-type"],
          "application/json",
        );
      });
    });
  });
});