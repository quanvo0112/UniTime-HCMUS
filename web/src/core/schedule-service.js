import { CourseClass, StudentSchedule } from "../models/scheduler-models.js";
import { periodToFloat } from "./course-service.js";

function hasTimeConflict(classA, classB) {
  const sameDay = Number(classA.classSchedule.dayOfWeek) === Number(classB.classSchedule.dayOfWeek);
  if (!sameDay) {
    return false;
  }

  const aStart = periodToFloat(classA.classSchedule.periodStart);
  const aEnd = periodToFloat(classA.classSchedule.periodEnd);
  const bStart = periodToFloat(classB.classSchedule.periodStart);
  const bEnd = periodToFloat(classB.classSchedule.periodEnd);

  return aStart <= bEnd && bStart <= aEnd;
}

export function createStudentSchedule() {
  return new StudentSchedule([]);
}

export function removeClassFromSchedule(schedule, classData) {
  const targetSchedule = schedule instanceof StudentSchedule ? schedule : StudentSchedule.fromJSON(schedule);
  const target = classData instanceof CourseClass ? classData : CourseClass.fromJSON(classData);

  const index = targetSchedule.classes.findIndex((item) => item === target || item.classId === target.classId);
  if (index < 0) {
    return false;
  }

  targetSchedule.classes.splice(index, 1);
  return true;
}

export function addClassToSchedule(schedule, classData) {
  const targetSchedule = schedule instanceof StudentSchedule ? schedule : StudentSchedule.fromJSON(schedule);
  const courseClass = classData instanceof CourseClass ? classData : CourseClass.fromJSON(classData);

  for (let i = 0; i < targetSchedule.classes.length; i += 1) {
    if (hasTimeConflict(courseClass, targetSchedule.classes[i])) {
      return { added: false, reason: "TIME_CONFLICT" };
    }
  }

  targetSchedule.classes.push(courseClass);
  return { added: true, reason: null };
}

export function hasScheduleConflict(schedule, classData) {
  const targetSchedule = schedule instanceof StudentSchedule ? schedule : StudentSchedule.fromJSON(schedule);
  const courseClass = classData instanceof CourseClass ? classData : CourseClass.fromJSON(classData);

  return targetSchedule.classes.some((item) => hasTimeConflict(item, courseClass));
}

export { hasTimeConflict };
