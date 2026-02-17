# COMP3133_101484904_Assignment1

Node.js backend for an Employee Management System built with Express, Apollo Server, GraphQL, MongoDB (Mongoose), JWT authentication, bcrypt password hashing, Cloudinary photo upload, and express-validator input validation.

## Tech Stack

- Express.js
- Apollo Server (GraphQL)
- MongoDB + Mongoose
- dotenv
- bcrypt
- jsonwebtoken
- cloudinary
- express-validator

## Project Structure

- `server.js`
- `config/db.js`
- `config/cloudinary.js`
- `graphql/typeDefs.js`
- `graphql/resolvers.js`
- `models/User.js`
- `models/Employee.js`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```env
PORT=4000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<dbname>
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

3. Run in development mode:

```bash
npm run dev
```

4. Run in production mode:

```bash
npm start
```

GraphQL endpoint:

- `http://localhost:4000/graphql`

## GraphQL Operations

### Queries

- `login(username: String, email: String, password: String!): String`
- `getEmployees: [Employee]`
- `getEmployeeById(eid: ID!): Employee`
- `searchEmployee(designation: String, department: String): [Employee]`

### Mutations

- `signup(username: String!, email: String!, password: String!): User`
- `addEmployee(...) : Employee`
- `updateEmployee(...) : Employee`
- `deleteEmployee(eid: ID!): String`

## Notes

- `signup` hashes passwords with bcrypt.
- `login` returns a JWT token string.
- `salary` is validated to be at least `1000`.
- User and Employee email addresses are unique.
- Employee photo is uploaded to Cloudinary when `employee_photo` is provided (base64 image data or a public image URL).
- GraphQL errors return clear messages for validation and runtime issues.
