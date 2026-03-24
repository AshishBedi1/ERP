/**
 * Seed first employer user.
 * Run: node src/scripts/seedEmployer.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db';

const seedEmployer = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    const existingEmployer = await User.findOne({ role: 'employer' });
    if (existingEmployer) {
      console.log('Employer already exists:', existingEmployer.email);
      process.exit(0);
      return;
    }

    const employer = await User.create({
      name: 'Default Employer',
      email: 'employer@erp.com',
      password: 'Employer@123',
      role: 'employer',
      companyName: 'Acme Inc.',
    });

    console.log('Employer created:', employer.email);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedEmployer();
