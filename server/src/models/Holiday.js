const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    /** Calendar date the holiday is observed (stored at UTC midnight for the chosen local day). */
    date: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

holidaySchema.index({ employerId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaySchema);
