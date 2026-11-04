import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    },
    passwordHash: { type: String, required: true, select: false },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export const AdminUser = mongoose.model('AdminUser', schema);
