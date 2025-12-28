import { validateAnswer, validateStudentCode } from './validation.js';

const IDENTIFIER_PATTERN = '[A-Za-z_][A-Za-z0-9_]*';

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

  const baseResult = validateAnswer(lesson, studentCode);
  if (baseResult.correct) {
    return baseResult;
  }

  return applyGuidedValidation(lesson, studentCode, baseResult);
}

function buildSuccessResult(lesson, message) {
  return {
    correct: true,
    hasAttempt: true,
    message: message || lesson?.reward?.message || 'Excellent work!',
    reward: lesson?.reward || null,
    nextLesson: lesson?.nextLesson || null,
  };
}

function buildErrorResult(baseResult, message, hint) {
  return {
    ...baseResult,
    message,
    hint: hint ?? baseResult.hint,
  };
}

function applyGuidedValidation(lesson, studentCode, baseResult) {
  if (!lesson || !lesson.id || !lesson.exercise) {
    return baseResult;
  }

  switch (lesson.id) {
    case 'lesson-1':
      return validateLesson1(lesson, studentCode, baseResult);
    case 'lesson-2':
      return validateLesson2(lesson, studentCode, baseResult);
    case 'lesson-3':
      return validateLesson3(lesson, studentCode, baseResult);
    case 'lesson-4':
      return validateLesson4(lesson, studentCode, baseResult);
    case 'lesson-5':
      return validateLesson5(lesson, studentCode, baseResult);
    default:
      return baseResult;
  }
}

function validateLesson1(lesson, studentCode, baseResult) {
  const expectedVar = 'favorite_animal';
  const expectedAssignment = new RegExp(`\\b${expectedVar}\\s*=\\s*["'][^"']+["']`);
  const expectedWithoutQuotes = new RegExp(`\\b${expectedVar}\\s*=\\s*[^"'\\n]+`);

  if (expectedWithoutQuotes.test(studentCode) && !expectedAssignment.test(studentCode)) {
    return buildErrorResult(
      baseResult,
      'Use quotes around the animal name, like favorite_animal = "cat".',
      lesson.exercise.hint
    );
  }

  const assignmentMatch = studentCode.match(
    new RegExp(`\\b(${IDENTIFIER_PATTERN})\\s*=\\s*["'][^"']+["']`)
  );
  if (assignmentMatch) {
    const variableName = assignmentMatch[1];
    const printsVariable = new RegExp(`print\\s*\\(\\s*${variableName}\\s*\\)`).test(studentCode);
    if (printsVariable && variableName !== expectedVar) {
      return buildSuccessResult(
        lesson,
        `Nice work! Tip: name the variable "${expectedVar}" to match the instructions.`
      );
    }

    if (variableName !== expectedVar) {
      return buildErrorResult(
        baseResult,
        `Try naming the variable "${expectedVar}" and printing it.`,
        lesson.exercise.hint
      );
    }
  }

  return baseResult;
}

function validateLesson2(lesson, studentCode, baseResult) {
  const stringNumberAssignment = /\b(my_candies|friend_candies)\s*=\s*["']\d+["']/;
  if (stringNumberAssignment.test(studentCode)) {
    return buildErrorResult(
      baseResult,
      'Use numbers without quotes for candies (e.g., 7 instead of "7").',
      lesson.exercise.hint
    );
  }

  const numberAssignments = studentCode.match(new RegExp(`\\b${IDENTIFIER_PATTERN}\\s*=\\s*\\d+`, 'g')) || [];
  const hasPlus = studentCode.includes('+');

  if (numberAssignments.length >= 2 && hasPlus) {
    return buildSuccessResult(
      lesson,
      'Nice work! Tip: follow the variable names from the template for this exercise.'
    );
  }

  if (numberAssignments.length >= 2 && !hasPlus) {
    return buildErrorResult(
      baseResult,
      'Remember to add the two candy counts together with +.',
      lesson.exercise.hint
    );
  }

  return baseResult;
}

function validateLesson3(lesson, studentCode, baseResult) {
  const expectedVar = 'my_name';
  const expectedAssignment = new RegExp(`\\b${expectedVar}\\s*=\\s*["'][^"']+["']`);
  const expectedWithoutQuotes = new RegExp(`\\b${expectedVar}\\s*=\\s*[^"'\\n]+`);

  if (expectedWithoutQuotes.test(studentCode) && !expectedAssignment.test(studentCode)) {
    return buildErrorResult(
      baseResult,
      'Put your name in quotes so Python knows it is text.',
      lesson.exercise.hint
    );
  }

  const assignmentMatch = studentCode.match(
    new RegExp(`\\b(${IDENTIFIER_PATTERN})\\s*=\\s*["'][^"']+["']`)
  );
  if (assignmentMatch) {
    const variableName = assignmentMatch[1];
    const usesVariable = new RegExp(`\\+\\s*${variableName}\\b|\\b${variableName}\\s*\\+`).test(studentCode);
    if (usesVariable && variableName !== expectedVar) {
      return buildSuccessResult(
        lesson,
        `Nice work! Tip: name the variable "${expectedVar}" to match the instructions.`
      );
    }

    if (variableName !== expectedVar) {
      return buildErrorResult(
        baseResult,
        `Try creating a variable named "${expectedVar}" and use it in your welcome message.`,
        lesson.exercise.hint
      );
    }
  }

  return baseResult;
}

function validateLesson4(lesson, studentCode, baseResult) {
  const listMatch = studentCode.match(/\[[\s\S]*?\]/);
  if (listMatch) {
    const quotedItems = listMatch[0].match(/["'][^"']+["']/g) || [];

    if (quotedItems.length >= 3) {
      if (!/\bmy_hobbies\s*=/.test(studentCode)) {
        return buildSuccessResult(
          lesson,
          'Nice work! Tip: name the list "my_hobbies" to match the instructions.'
        );
      }
    } else if (quotedItems.length > 0) {
      return buildErrorResult(
        baseResult,
        'Add at least three hobbies to the list.',
        lesson.exercise.hint
      );
    } else {
      return buildErrorResult(
        baseResult,
        'Put each hobby in quotes, like "reading".',
        lesson.exercise.hint
      );
    }
  }

  return baseResult;
}

function validateLesson5(lesson, studentCode, baseResult) {
  const functionMatch = studentCode.match(
    new RegExp(`def\\s+(${IDENTIFIER_PATTERN})\\s*\\(\\s*(${IDENTIFIER_PATTERN})\\s*\\)`, 's')
  );

  if (functionMatch) {
    const functionName = functionMatch[1];
    const paramName = functionMatch[2];
    const usesParam = new RegExp(`return[\\s\\S]*\\b${paramName}\\b`).test(studentCode);

    if (usesParam && functionName !== 'make_introduction') {
      return buildSuccessResult(
        lesson,
        'Nice work! Tip: name the function "make_introduction" to match the instructions.'
      );
    }

    if (/def\s+make_introduction/.test(studentCode) && !/return\b/.test(studentCode)) {
      return buildErrorResult(
        baseResult,
        'Remember to return the greeting from the function.',
        lesson.exercise.hint
      );
    }
  }

  return baseResult;
}
