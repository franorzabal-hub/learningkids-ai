/**
 * Data loading utilities for LearnKids AI
 * Extracted for testability
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Load courses catalog from JSON file
 * @param {string} dataDir - Path to data directory
 * @returns {Promise<Object>} Courses data
 */
export async function loadCoursesFromFile(dataDir) {
  const coursesPath = path.join(dataDir, 'courses.json');
  const data = await fs.readFile(coursesPath, 'utf-8');
  const coursesData = JSON.parse(data);

  if (!coursesData.courses || !Array.isArray(coursesData.courses)) {
    throw new Error('Invalid courses data structure');
  }

  return coursesData;
}

/**
 * Load lessons for a specific course
 * @param {string} dataDir - Path to data directory
 * @param {string} courseId - Course ID
 * @returns {Promise<Object>} Lessons data
 */
export async function loadLessonsFromFile(dataDir, courseId) {
  const lessonsPath = path.join(dataDir, 'lessons', `${courseId}.json`);
  const data = await fs.readFile(lessonsPath, 'utf-8');
  const lessonsData = JSON.parse(data);

  if (!lessonsData.lessons || !Array.isArray(lessonsData.lessons)) {
    throw new Error('Invalid lessons data structure');
  }

  return lessonsData;
}

/**
 * Create a cached data loader
 * @param {string} dataDir - Path to data directory
 * @returns {Object} Data loader with caching
 */
export function createDataLoader(dataDir) {
  let coursesCache = null;
  const lessonsCache = new Map();

  return {
    async loadCourses() {
      if (coursesCache) return coursesCache;
      coursesCache = await loadCoursesFromFile(dataDir);
      return coursesCache;
    },

    async loadLessons(courseId) {
      if (lessonsCache.has(courseId)) {
        return lessonsCache.get(courseId);
      }
      const lessons = await loadLessonsFromFile(dataDir, courseId);
      lessonsCache.set(courseId, lessons);
      return lessons;
    },

    clearCache() {
      coursesCache = null;
      lessonsCache.clear();
    },

    getCoursesCached() {
      return coursesCache;
    },
  };
}
