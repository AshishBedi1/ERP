/**
 * Reset employer credentials - creates or updates employer@erp.com
 * Run: npm run reset:employer
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db';

const resetEmployer = async () => {
  try {
    await mongoose.connect(MONGODB_URI);

    const user = await User.findOne({ email: 'employer@erp.com' });

    if (user) {
      user.password = 'Employer@123';
      user.role = 'employer';
      user.name = 'Default Employer';
      user.companyName = user.companyName || 'Acme Inc.';
      await user.save();
      console.log('Employer password reset.');
    } else {
      await User.create({
        name: 'Default Employer',
        email: 'employer@erp.com',
        password: 'Employer@123',
        role: 'employer',
        companyName: 'Acme Inc.',
      });
      console.log('Employer created.');
    }

    console.log('Login: employer@erp.com / Employer@123');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

resetEmployer();
