'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const GQL = require('..')
const { GraphQLScalarType } = require('graphql')

test('basic GQL', async (t) => {
  const app = Fastify()
  const schema = `
    type Query {
      add(x: Int, y: Int): Int
    }
  `

  const resolvers = {
    add: async ({ x, y }) => x + y
  }

  app.register(GQL, {
    schema,
    resolvers
  })

  // needed so that graphql is defined
  await app.ready()

  const query = '{ add(x: 2, y: 2) }'
  const res = await app.graphql(query)

  t.deepEqual(res, {
    data: {
      add: 4
    }
  })
})

test('support context', async (t) => {
  const app = Fastify()
  const schema = `
    type Query {
      ctx: Int
    }
  `

  const resolvers = {
    ctx: async (_, ctx) => {
      t.equal(ctx.app, app)
      return ctx.num
    }
  }

  app.register(GQL, {
    schema,
    resolvers
  })

  // needed so that graphql is defined
  await app.ready()

  const query = '{ ctx }'
  const res = await app.graphql(query, { num: 42 })

  t.deepEqual(res, {
    data: {
      ctx: 42
    }
  })
})

test('variables', async (t) => {
  const app = Fastify()
  const schema = `
    type Query {
      add(x: Int, y: Int): Int
    }
  `

  const resolvers = {
    add: async ({ x, y }) => x + y
  }

  app.register(GQL, {
    schema,
    resolvers
  })

  // needed so that graphql is defined
  await app.ready()

  const query = 'query ($x: Int!, $y: Int!) { add(x: $x, y: $y) }'
  const res = await app.graphql(query, null, {
    x: 2,
    y: 2
  })

  t.deepEqual(res, {
    data: {
      add: 4
    }
  })
})

test('operationName', async (t) => {
  const app = Fastify()
  const schema = `
    type Query {
      add(x: Int, y: Int): Int
    }
  `

  const resolvers = {
    add: async ({ x, y }) => x + y
  }

  app.register(GQL, {
    schema,
    resolvers
  })

  // needed so that graphql is defined
  await app.ready()

  const query = `
    query MyQuery ($x: Int!, $y: Int!) {
      add(x: $x, y: $y)
    }

    query Double ($x: Int!) {
      add(x: $x, y: $x)
    }
  `
  const res = await app.graphql(query, null, {
    x: 2,
    y: 1 // useless
  }, 'Double')

  t.deepEqual(res, {
    data: {
      add: 4
    }
  })
})

test('addToSchema and addToresolvers', async (t) => {
  const app = Fastify()
  const schema = `
    extend type Query {
      add(x: Int, y: Int): Int
    }
  `

  const resolvers = {
    add: async ({ x, y }) => x + y
  }

  app.register(GQL)

  app.register(async function (app) {
    app.graphql.extendSchema(schema)
    app.graphql.defineResolvers(resolvers)
  })

  // needed so that graphql is defined
  await app.ready()

  const query = '{ add(x: 2, y: 2) }'
  const res = await app.graphql(query)

  t.deepEqual(res, {
    data: {
      add: 4
    }
  })
})

test('basic GQL no cache', async (t) => {
  const app = Fastify()
  const schema = `
    type Query {
      add(x: Int, y: Int): Int
    }
  `

  const resolvers = {
    add: async ({ x, y }) => x + y
  }

  app.register(GQL, {
    schema,
    resolvers,
    cache: false
  })

  // needed so that graphql is defined
  await app.ready()

  const query = '{ add(x: 2, y: 2) }'
  const res = await app.graphql(query)

  t.deepEqual(res, {
    data: {
      add: 4
    }
  })
})

test('complex types', async (t) => {
  const app = Fastify()
  const schema = `
    type Person {
      name: String
      friends: [Person]
    }

    type Query {
      people: [Person]
    }
  `

  const resolvers = {
    Person: {
      friends: (root) => {
        if (root.name === 'matteo') {
          return [Promise.resolve({ name: 'marco' })]
        }
        if (root.name === 'marco') {
          return [Promise.resolve({ name: 'matteo' })]
        }
        return []
      }
    },
    Query: {
      people: (root) => {
        return [Promise.resolve({
          name: 'matteo'
        }), Promise.resolve({
          name: 'marco'
        })]
      }
    }
  }

  app.register(GQL, {
    schema,
    resolvers
  })

  // needed so that graphql is defined
  await app.ready()

  const query = '{ people { name, friends { name } } }'
  const res = await app.graphql(query)

  t.deepEqual(res, {
    data: {
      people: [{
        name: 'matteo',
        friends: [{
          name: 'marco'
        }]
      }, {
        name: 'marco',
        friends: [{
          name: 'matteo'
        }]
      }]
    }
  })
})

test('scalar should be supported', async (t) => {
  t.plan(2)

  const app = Fastify()
  const schema = `
    scalar Date

    type Query {
      add(x: Int, y: Int): Date
    }
  `

  const resolvers = {
    add: async ({ x, y }) => x + y,
    Date: new GraphQLScalarType({
      name: 'Date',
      description: 'Date custom scalar type',
      parseValue (value) {
        return value
      },
      serialize (value) {
        t.pass(value, 4)
        return value
      },
      parseLiteral (ast) {
        // not called on this test
        return null
      }
    })
  }

  app.register(GQL, {
    schema,
    resolvers
  })

  // needed so that graphql is defined
  await app.ready()

  const query = '{ add(x: 2, y: 2) }'
  const res = await app.graphql(query)

  t.deepEqual(res, {
    data: {
      add: 4
    }
  })
})
