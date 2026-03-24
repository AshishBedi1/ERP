const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['employer', 'employee'],
      required: true,
      default: 'employee',
    },
    // For employees: linked to their employer
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // For employers: company/organization name
    companyName: {
      type: String,
      trim: true,
      default: null,
    },
    /** Legacy total days / year; prefer sick + casual + earned. Kept for backward compatibility. */
    annualLeaveDays: {
      type: Number,
      default: null,
      min: 0,
    },
    /** Employer policy: sick / casual / earned per calendar year (Finalrope-style defaults). */
    sickLeaveAnnual: {
      type: Number,
      default: null,
      min: 0,
    },
    casualLeaveAnnual: {
      type: Number,
      default: null,
      min: 0,
    },
    earnedLeaveAnnual: {
      type: Number,
      default: null,
      min: 0,
    },
    /** Policy target for statutory public holidays per year (e.g. 15). */
    publicHolidaysPolicyCount: {
      type: Number,
      default: null,
      min: 0,
    },
    /** Employee: date of joining (HR record). */
    dateOfJoining: {
      type: Date,
      default: null,
    },
    // Status for approval flows (optional)
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
