const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { GraphQLError } = require('graphql');
const { checkSchema, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const User = require('../models/User');
const Employee = require('../models/Employee');
const cloudinary = require('../config/cloudinary');

const runValidation = async (schema, args) => {
  const req = { body: args };
  const validations = checkSchema(schema);

  await Promise.all(validations.map((validation) => validation.run(req)));

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    throw new GraphQLError(firstError.msg, {
      extensions: {
        code: 'BAD_USER_INPUT',
        details: errors.array(),
      },
    });
  }
};

const uploadEmployeePhoto = async (employeePhoto) => {
  if (!employeePhoto) {
    return null;
  }

  try {
    const result = await cloudinary.uploader.upload(employeePhoto, {
      folder: 'employee-management/employees',
      resource_type: 'image',
    });

    return result.secure_url;
  } catch (error) {
    throw new GraphQLError('Employee photo upload failed.', {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        details: error.message,
      },
    });
  }
};

const handleDuplicateEmailError = (error) => {
  if (error && error.code === 11000 && error.keyPattern && error.keyPattern.email) {
    throw new GraphQLError('Email already exists.', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  throw error;
};

const resolvers = {
  Query: {
    login: async (_, args) => {
      await runValidation(
        {
          password: {
            in: ['body'],
            notEmpty: {
              errorMessage: 'Password is required.',
            },
            isLength: {
              options: { min: 6 },
              errorMessage: 'Password must be at least 6 characters.',
            },
          },
        },
        args
      );

      const { username, email, password } = args;

      if (!username && !email) {
        throw new GraphQLError('Either username or email is required for login.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const query = username ? { username } : { email: email.toLowerCase() };
      const user = await User.findOne(query);

      if (!user) {
        throw new GraphQLError('Invalid credentials.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const passwordMatched = await bcrypt.compare(password, user.password);
      if (!passwordMatched) {
        throw new GraphQLError('Invalid credentials.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new GraphQLError('JWT_SECRET is not configured.', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return jwt.sign(
        {
          userId: user._id,
          username: user.username,
          email: user.email,
        },
        jwtSecret,
        { expiresIn: '1d' }
      );
    },

    getEmployees: async () => Employee.find().sort({ created_at: -1 }),

    getEmployeeById: async (_, { eid }) => {
      if (!mongoose.Types.ObjectId.isValid(eid)) {
        throw new GraphQLError('Invalid employee ID.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const employee = await Employee.findById(eid);
      if (!employee) {
        throw new GraphQLError('Employee not found.', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return employee;
    },

    searchEmployee: async (_, { designation, department }) => {
      if (!designation && !department) {
        throw new GraphQLError('Provide at least one filter: designation or department.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const filter = {};
      if (designation) {
        filter.designation = new RegExp(designation, 'i');
      }
      if (department) {
        filter.department = new RegExp(department, 'i');
      }

      return Employee.find(filter).sort({ created_at: -1 });
    },
  },

  Mutation: {
    signup: async (_, args) => {
      await runValidation(
        {
          username: {
            in: ['body'],
            notEmpty: { errorMessage: 'Username is required.' },
            isLength: {
              options: { min: 3 },
              errorMessage: 'Username must be at least 3 characters.',
            },
          },
          email: {
            in: ['body'],
            notEmpty: { errorMessage: 'Email is required.' },
            isEmail: { errorMessage: 'Email format is invalid.' },
          },
          password: {
            in: ['body'],
            notEmpty: { errorMessage: 'Password is required.' },
            isLength: {
              options: { min: 6 },
              errorMessage: 'Password must be at least 6 characters.',
            },
          },
        },
        args
      );

      const { username, email, password } = args;

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new GraphQLError('Email already exists.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      try {
        return await User.create({
          username,
          email: email.toLowerCase(),
          password: hashedPassword,
        });
      } catch (error) {
        handleDuplicateEmailError(error);
      }
    },

    addEmployee: async (_, args) => {
      await runValidation(
        {
          first_name: {
            in: ['body'],
            notEmpty: { errorMessage: 'First name is required.' },
          },
          last_name: {
            in: ['body'],
            notEmpty: { errorMessage: 'Last name is required.' },
          },
          email: {
            in: ['body'],
            notEmpty: { errorMessage: 'Email is required.' },
            isEmail: { errorMessage: 'Email format is invalid.' },
          },
          designation: {
            in: ['body'],
            notEmpty: { errorMessage: 'Designation is required.' },
          },
          salary: {
            in: ['body'],
            isFloat: {
              options: { min: 1000 },
              errorMessage: 'Salary must be at least 1000.',
            },
          },
          date_of_joining: {
            in: ['body'],
            notEmpty: { errorMessage: 'Date of joining is required.' },
            isISO8601: {
              errorMessage: 'date_of_joining must be a valid date (YYYY-MM-DD).',
            },
          },
          department: {
            in: ['body'],
            notEmpty: { errorMessage: 'Department is required.' },
          },
          employee_photo: {
            in: ['body'],
            optional: true,
            isString: {
              errorMessage: 'employee_photo must be a string (URL or base64 image data).',
            },
          },
        },
        args
      );

      const existingEmployee = await Employee.findOne({ email: args.email.toLowerCase() });
      if (existingEmployee) {
        throw new GraphQLError('Email already exists.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      let photoUrl = null;
      if (args.employee_photo) {
        photoUrl = await uploadEmployeePhoto(args.employee_photo);
      }

      try {
        return await Employee.create({
          ...args,
          email: args.email.toLowerCase(),
          employee_photo: photoUrl,
        });
      } catch (error) {
        handleDuplicateEmailError(error);
      }
    },

    updateEmployee: async (_, args) => {
      await runValidation(
        {
          eid: {
            in: ['body'],
            notEmpty: { errorMessage: 'Employee ID is required.' },
          },
          email: {
            in: ['body'],
            optional: true,
            isEmail: { errorMessage: 'Email format is invalid.' },
          },
          salary: {
            in: ['body'],
            optional: true,
            isFloat: {
              options: { min: 1000 },
              errorMessage: 'Salary must be at least 1000.',
            },
          },
        },
        args
      );

      const { eid, ...updates } = args;

      if (!mongoose.Types.ObjectId.isValid(eid)) {
        throw new GraphQLError('Invalid employee ID.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      if (updates.email) {
        const emailLower = updates.email.toLowerCase();
        const existingEmployee = await Employee.findOne({
          _id: { $ne: eid },
          email: emailLower,
        });

        if (existingEmployee) {
          throw new GraphQLError('Email already exists.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        updates.email = emailLower;
      }

      try {
        const updatedEmployee = await Employee.findByIdAndUpdate(eid, updates, {
          new: true,
          runValidators: true,
        });

        if (!updatedEmployee) {
          throw new GraphQLError('Employee not found.', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        return updatedEmployee;
      } catch (error) {
        handleDuplicateEmailError(error);
      }
    },

    deleteEmployee: async (_, { eid }) => {
      if (!mongoose.Types.ObjectId.isValid(eid)) {
        throw new GraphQLError('Invalid employee ID.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const deletedEmployee = await Employee.findByIdAndDelete(eid);
      if (!deletedEmployee) {
        throw new GraphQLError('Employee not found.', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return 'Employee deleted successfully.';
    },
  },
};

module.exports = resolvers;
