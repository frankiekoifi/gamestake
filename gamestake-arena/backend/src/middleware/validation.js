// src/middleware/validation.js
const { body, validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({ errors: errors.array() });
  };
};

const userValidation = {
  register: [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/),
    body('username').isLength({ min: 3, max: 20 }).isAlphanumeric(),
    body('phone').optional().isMobilePhone()
  ],
  
  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ]
};

const matchValidation = {
  create: [
    body('game').notEmpty(),
    body('wagerAmount').isFloat({ min: 50, max: 100000 }),
    body('rules').optional().isObject()
  ]
};

module.exports = { validate, userValidation, matchValidation };