require('dotenv').config();

const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const connectDB = require('./config/db');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');

const startServer = async () => {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  await connectDB();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ req }),
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}${server.graphqlPath}`);
  });
};

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
