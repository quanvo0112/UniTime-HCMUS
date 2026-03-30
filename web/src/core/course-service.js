import {
  ClassSchedule,
  CourseClass,
  FILTER_PROPERTY,
  FLOAT_TO_PERIOD,
  MAX_CLASSES_PER_DAY,
  PERIOD_TO_FLOAT,
} from "../models/scheduler-models.js";

const PERIOD_EPSILON = 0.01;

function normalizeTextForSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parsePeriod(periodFloat) {
  const value = Number(periodFloat);
  const knownValues = Object.values(PERIOD_TO_FLOAT);

  for (let i = 0; i < knownValues.length; i += 1) {
    if (Math.abs(value - knownValues[i]) < PERIOD_EPSILON) {
      return FLOAT_TO_PERIOD[String(knownValues[i])];
    }
  }

  throw new Error(`Invalid period float: ${periodFloat}`);
}

export function periodToFloat(period) {
  const mapped = PERIOD_TO_FLOAT[period];
  if (typeof mapped !== "number") {
    throw new Error(`Invalid period enum value: ${period}`);
  }
  return mapped;
}

export function classToString(courseClass) {
  const c = courseClass instanceof CourseClass ? courseClass : CourseClass.fromJSON(courseClass);
  const start = periodToFloat(c.classSchedule.periodStart);
  const end = periodToFloat(c.classSchedule.periodEnd);

  return `${c.courseId} | ${c.courseName} | ${c.classId} | ${c.location} | ${c.enrolledCount}/${c.classSize} | TC:${c.creditCount} | T${c.classSchedule.dayOfWeek} ${start.toFixed(1)}-${end.toFixed(1)} | ${c.year}`;
}

export function parseClassSchedule(scheduleStr) {
  const raw = String(scheduleStr || "").trim();
  const match = raw.match(/^T\s*(\d+)\s*\(\s*(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*\)$/i);

  if (!match) {
    throw new Error(`Invalid schedule format: ${scheduleStr}`);
  }

  const dayOfWeek = Number(match[1]);
  const periodStart = parsePeriod(Number(match[2].replace(",", ".")));
  const periodEnd = parsePeriod(Number(match[3].replace(",", ".")));

  return new ClassSchedule({ dayOfWeek, periodStart, periodEnd });
}

function unwrapValue(value) {
  const text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function splitTabularLine(line) {
  const raw = String(line || "").trim();

  if (raw.includes("\t")) {
    return raw.split("\t").map(unwrapValue);
  }

  if (raw.includes("\\t")) {
    return raw.split("\\t").map(unwrapValue);
  }

  const separators = [";", ",", "|"];
  let bestSeparator = null;
  let bestCount = 0;

  separators.forEach((separator) => {
    const count = raw.split(separator).length;
    if (count > bestCount) {
      bestCount = count;
      bestSeparator = separator;
    }
  });

  if (bestSeparator && bestCount >= 8) {
    return raw.split(bestSeparator).map(unwrapValue);
  }

  return [raw];
}

function looksLikeHeader(columns) {
  const text = columns.join(" ").toLowerCase();
  return (
    text.includes("course") ||
    text.includes("class") ||
    text.includes("credit") ||
    text.includes("enrolled") ||
    text.includes("schedule")
  );
}

export function parseClassFromTSVLine(line) {
  const columns = splitTabularLine(line);
  if (columns.length < 8) {
    throw new Error("Invalid class row: expected at least 8 tabular columns");
  }

  const locationIndex = columns.length >= 11 ? 10 : 8;
  const scheduleIndex = 7;

  return new CourseClass({
    courseId: columns[0] || "",
    courseName: columns[1] || "",
    classId: columns[2] || "",
    creditCount: Number(columns[3] || 0),
    classSize: Number(columns[4] || 0),
    enrolledCount: Number(columns[5] || 0),
    year: Number(columns[6] || 0),
    classSchedule: parseClassSchedule(columns[scheduleIndex] || ""),
    location: columns[locationIndex] || "",
  });
}

export function parseClassesFromTSVText(tsvText, { skipHeader = true } = {}) {
  const lines = String(tsvText || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const dataLines = [...lines];
  if (skipHeader && dataLines.length > 0) {
    dataLines.shift();
  } else if (!skipHeader && dataLines.length > 0) {
    const firstColumns = splitTabularLine(dataLines[0]);
    if (looksLikeHeader(firstColumns)) {
      dataLines.shift();
    }
  }

  const classes = [];

  for (let i = 0; i < dataLines.length; i += 1) {
    try {
      classes.push(parseClassFromTSVLine(dataLines[i]));
    } catch (error) {
      // Skip malformed rows so one bad line does not block the whole import.
    }
  }

  return classes;
}

export function filterByCourseId(classes, courseId) {
  const searchText = normalizeTextForSearch(courseId);
  return (classes || []).filter((item) =>
    normalizeTextForSearch(item.courseId).includes(searchText)
  );
}

export function filterByCourseName(classes, courseName) {
  const searchText = normalizeTextForSearch(courseName);
  return (classes || []).filter((item) =>
    normalizeTextForSearch(item.courseName).includes(searchText)
  );
}

export function filterByClassId(classes, classId) {
  const searchText = normalizeTextForSearch(classId);
  return (classes || []).filter((item) =>
    normalizeTextForSearch(item.classId).includes(searchText)
  );
}

export function filterByAll(classes, searchText) {
  const search = normalizeTextForSearch(searchText);
  return (classes || []).filter((item) => {
    return (
      normalizeTextForSearch(item.courseId).includes(search) ||
      normalizeTextForSearch(item.courseName).includes(search) ||
      normalizeTextForSearch(item.classId).includes(search)
    );
  });
}

export function filterByPeriod(classes, dayOfWeek, period) {
  const periodValue = periodToFloat(period);

  return (classes || []).filter((item) => {
    const sameDay = Number(item.classSchedule.dayOfWeek) === Number(dayOfWeek);
    const start = periodToFloat(item.classSchedule.periodStart);
    const end = periodToFloat(item.classSchedule.periodEnd);
    return sameDay && start <= periodValue && periodValue <= end;
  });
}

export function filterClasses(classes, propertyIndex, searchText) {
  switch (propertyIndex) {
    case FILTER_PROPERTY.COURSE_ID:
      return filterByCourseId(classes, searchText);
    case FILTER_PROPERTY.COURSE_NAME:
      return filterByCourseName(classes, searchText);
    case FILTER_PROPERTY.CLASS_ID:
      return filterByClassId(classes, searchText);
    case FILTER_PROPERTY.ALL:
    default:
      return filterByAll(classes, searchText);
  }
}

export function countClassesByDay(classes, dayOfWeek) {
  return (classes || []).filter((item) => Number(item.classSchedule.dayOfWeek) === Number(dayOfWeek)).length;
}

export function canAddMoreInDay(classes, dayOfWeek) {
  return countClassesByDay(classes, dayOfWeek) < MAX_CLASSES_PER_DAY;
}
