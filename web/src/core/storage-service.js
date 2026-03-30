import { StudentSchedule } from "../models/scheduler-models.js";

const STORAGE_KEY = "scheduler-raylib-migration-v1";

export function saveScheduleToStorage(schedule) {
  const payload = schedule instanceof StudentSchedule ? schedule.toJSON() : schedule;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadScheduleFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return new StudentSchedule([]);
  }

  try {
    const parsed = JSON.parse(raw);
    return StudentSchedule.fromJSON(parsed);
  } catch (error) {
    return new StudentSchedule([]);
  }
}

export function clearScheduleStorage() {
  localStorage.removeItem(STORAGE_KEY);
}
