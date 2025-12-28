import { validateAnswer, validateStudentCode } from './validation.js';

export function buildStudentValidation(lesson, studentCode, options = {}) {
  const maxLength = typeof options.maxLength === 'number' ? options.maxLength : 5000;

  if (typeof studentCode !== 'string') {
    return {
      correct: false,
      hasAttempt: false,
      message: 'Code must be a string',
      error: 'Code must be a string',
    };
  }

  const trimmed = studentCode.trim();
  if (trimmed.length === 0) {
    return validateAnswer(lesson, studentCode);
  }

  const codeValidation = validateStudentCode(studentCode, maxLength);
  if (!codeValidation.valid) {
    return {
      correct: false,
      hasAttempt: true,
      message: codeValidation.error || 'Invalid code',
      error: codeValidation.error,
    };
  }

  return validateAnswer(lesson, studentCode);
}
