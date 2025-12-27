/**
 * Validation utilities for LearnKids AI
 * Extracted for testability
 */

/**
 * Validate a course ID for security and existence
 * @param {string} courseId - Course ID to validate
 * @param {Object} coursesData - Loaded courses data
 * @returns {boolean} True if valid
 */
export function isValidCourseId(courseId, coursesData) {
  // Must have courses data loaded
  if (!coursesData || !coursesData.courses) return false;

  // Must be a non-empty string
  if (typeof courseId !== 'string' || courseId.length === 0) {
    return false;
  }

  // Prevent path traversal attacks
  if (courseId.includes('..') || courseId.includes('/') || courseId.includes('\\')) {
    return false;
  }

  // Prevent null byte injection
  if (courseId.includes('\0')) {
    return false;
  }

  // Check for URL-encoded path traversal
  const decoded = decodeURIComponent(courseId);
  if (decoded.includes('..') || decoded.includes('/') || decoded.includes('\\')) {
    return false;
  }

  // Verify course exists
  return coursesData.courses.some(course => course.id === courseId);
}

/**
 * Validate lesson ID format
 * @param {string} lessonId - Lesson ID to validate
 * @returns {boolean} True if valid format
 */
export function isValidLessonId(lessonId) {
  if (typeof lessonId !== 'string') return false;

  // Prevent path traversal
  if (lessonId.includes('..') || lessonId.includes('/') || lessonId.includes('\\')) {
    return false;
  }

  // Must match lesson-N format
  return /^lesson-\d+$/.test(lessonId);
}

/**
 * Validate student code submission
 * @param {string} studentCode - Student's code submission
 * @param {number} maxLength - Maximum allowed length (default 5000)
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateStudentCode(studentCode, maxLength = 5000) {
  if (typeof studentCode !== 'string') {
    return { valid: false, error: 'Code must be a string' };
  }

  if (studentCode.length === 0) {
    return { valid: false, error: 'No code provided' };
  }

  if (studentCode.trim().length === 0) {
    return { valid: false, error: 'Code cannot be only whitespace' };
  }

  if (studentCode.length > maxLength) {
    return { valid: false, error: `Code exceeds maximum length of ${maxLength} characters` };
  }

  return { valid: true };
}

/**
 * Validate user's code answer against lesson's regex pattern
 * @param {Object} lesson - The lesson object containing validation rules
 * @param {string} userAnswer - User's submitted code
 * @returns {Object} Validation result
 */
export function validateAnswer(lesson, userAnswer) {
  // Check for empty answer
  if (!userAnswer || (typeof userAnswer === 'string' && userAnswer.trim().length === 0)) {
    return {
      correct: false,
      hasAttempt: false,
      message: 'Please write some code first!',
    };
  }

  // No validation rules - accept any non-empty answer
  if (!lesson.exercise || !lesson.exercise.validation) {
    return {
      correct: true,
      hasAttempt: true,
      message: 'Good effort! Keep going!',
    };
  }

  const { validation } = lesson.exercise;

  try {
    if (validation.type === 'regex' && validation.pattern) {
      // Use dotall flag (s) to handle multiline code
      const regex = new RegExp(validation.pattern, 's');
      const isValid = regex.test(userAnswer);

      if (isValid) {
        return {
          correct: true,
          hasAttempt: true,
          message: lesson.reward?.message || 'Excellent work!',
          reward: lesson.reward || null,
          nextLesson: lesson.nextLesson || null,
        };
      } else {
        return {
          correct: false,
          hasAttempt: true,
          message: validation.errorMessage || 'Not quite right. Try again!',
          hint: lesson.exercise.hint,
        };
      }
    }

    // Unknown validation type - accept answer
    return {
      correct: true,
      hasAttempt: true,
      message: 'Good effort!',
    };
  } catch (error) {
    // Regex error - fallback to basic check
    console.error('[Validation] Regex error:', error);
    return {
      correct: userAnswer.trim().length > 10,
      hasAttempt: true,
      message: 'Good effort!',
      error: error.message,
    };
  }
}
