import { periodToFloat, classToString } from "./core/course-service.js";
import { addClassToSchedule, createStudentSchedule, removeClassFromSchedule } from "./core/schedule-service.js";
import { clearScheduleStorage, loadScheduleFromStorage, saveScheduleToStorage } from "./core/storage-service.js";
import { fetchAvailableCourses, filterAvailableCourses } from "./core/available-courses-service.js";
import { PERIODS, renderLegend, renderTimetableShell } from "./ui/render-shell.js";
import { MAX_CLASSES_PER_DAY } from "./models/scheduler-models.js";

const state = {
  schedule: createStudentSchedule(),
  editingIndex: -1,
  availableCourses: [],
  availableSearchText: "",
};

function showStatus(statusEl, message, tone = "ok") {
  statusEl.textContent = message;
  statusEl.classList.remove("ok", "warn");
  statusEl.classList.add(tone);
}

function hashColorFromText(text) {
  let hash = 0;
  const input = String(text || "");
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 360;
  }
  return `hsl(${hash} 70% 55%)`;
}

function classIdentity(item) {
  return `${item.courseId}::${item.classId}::${item.classSchedule.dayOfWeek}`;
}

function classKey(item) {
  return `${item.courseId}::${item.classId}::${item.classSchedule.dayOfWeek}::${item.classSchedule.periodStart}::${item.classSchedule.periodEnd}`;
}

function renderScheduleList(listEl) {
  if (state.schedule.classes.length === 0) {
    listEl.innerHTML = "<li>No courses selected yet. Browse available courses above.</li>";
    return;
  }

  listEl.innerHTML = state.schedule.classes
    .map(
      (item, index) =>
        `<li>
          <span>${classToString(item)}</span>
          <span class="selected-actions">
            <button type="button" data-remove-index="${index}">Remove</button>
          </span>
        </li>`
    )
    .join("");
}

function renderAvailableCourses(listEl) {
  const filtered = filterAvailableCourses(state.availableCourses, state.availableSearchText);

  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="available-empty">No available courses match your search.</p>';
    return;
  }

  const selectedIdentities = new Set(state.schedule.classes.map(classIdentity));

  listEl.innerHTML = filtered
    .map((item) => {
      const identity = classIdentity(item);
      const disabled = selectedIdentities.has(identity);
      const disabledAttr = disabled ? "disabled" : "";
      const buttonText = disabled ? "Added" : "Add";

      return `
        <article class="available-row">
          <div>
            <strong>${item.courseId}</strong>
            <div class="available-meta">${item.classId}</div>
          </div>
          <div>
            <strong>${item.courseName}</strong>
            <div class="available-meta">${item.location || "TBA"}</div>
          </div>
          <div>
            <strong>T${item.classSchedule.dayOfWeek}</strong>
            <div class="available-meta">${periodToFloat(item.classSchedule.periodStart)} - ${periodToFloat(item.classSchedule.periodEnd)}</div>
          </div>
          <div>
            <strong>${item.creditCount} TC</strong>
            <div class="available-meta">${item.enrolledCount}/${item.classSize}</div>
          </div>
          <div>
            <button type="button" class="action-add" data-add-key="${classKey(item)}" ${disabledAttr}>${buttonText}</button>
          </div>
        </article>
      `;
    })
    .join("");
}



function clearTimetableCells(timetableEl) {
  timetableEl.querySelectorAll(".slot-cell").forEach((cell) => {
    cell.innerHTML = "";
  });
}

function renderScheduleOnGrid(timetableEl) {
  clearTimetableCells(timetableEl);

  state.schedule.classes.forEach((courseClass) => {
    const day = Number(courseClass.classSchedule.dayOfWeek);
    const periodStartFloat = periodToFloat(courseClass.classSchedule.periodStart);
    const periodEndFloat = periodToFloat(courseClass.classSchedule.periodEnd);
    const slotColor = hashColorFromText(`${courseClass.courseId}-${courseClass.classId}`);

    PERIODS.forEach((period) => {
      if (period < periodStartFloat || period > periodEndFloat) {
        return;
      }

      const selector = `.slot-cell[data-day=\"${day}\"][data-period=\"${period}\"]`;
      const targetCell = timetableEl.querySelector(selector);
      if (!targetCell) {
        return;
      }

      targetCell.innerHTML = `
        <article class="slot-card" style="--slot-color:${slotColor};">
          <strong>${courseClass.courseName}</strong>
          <small>${courseClass.classId} | ${courseClass.location || "TBA"}</small>
        </article>
      `;
    });
  });
}

function saveAndRender(timetableEl, listEl, availableListEl) {
  saveScheduleToStorage(state.schedule);
  renderScheduleOnGrid(timetableEl);
  renderScheduleList(listEl);
  renderAvailableCourses(availableListEl);
}

function canAddInDay(schedule, dayOfWeek) {
  const sameDayCount = schedule.classes.filter(
    (item) => Number(item.classSchedule.dayOfWeek) === Number(dayOfWeek)
  ).length;
  return sameDayCount < MAX_CLASSES_PER_DAY;
}



function bootstrapStep3UI() {
  if (typeof document === "undefined") {
    return;
  }

  state.schedule = loadScheduleFromStorage();

  const statusEl = document.getElementById("formStatus");
  const exportBtnEl = document.getElementById("exportScheduleBtn");
  const importBtnEl = document.getElementById("importScheduleBtn");
  const importFileEl = document.getElementById("importScheduleFile");
  const clearBtnEl = document.getElementById("clearScheduleBtn");
  const availableSearchEl = document.getElementById("availableSearch");
  const availableListEl = document.getElementById("availableCourses");
  const listEl = document.getElementById("selectedClasses");
  const timetableEl = document.getElementById("timetable");
  const legendEl = document.getElementById("legend");

  if (
    !statusEl ||
    !exportBtnEl ||
    !importBtnEl ||
    !importFileEl ||
    !clearBtnEl ||
    !availableSearchEl ||
    !availableListEl ||
    !listEl ||
    !timetableEl ||
    !legendEl
  ) {
    throw new Error("UI boot failed: missing required DOM nodes");
  }

  renderTimetableShell(timetableEl);
  renderLegend(legendEl);

  saveAndRender(timetableEl, listEl, availableListEl);

  fetchAvailableCourses()
    .then((courses) => {
      state.availableCourses = courses;
      renderAvailableCourses(availableListEl);
      showStatus(statusEl, `Loaded ${courses.length} available courses from JSON`, "ok");
    })
    .catch((error) => {
      showStatus(statusEl, error.message || "Unable to load available courses", "warn");
      renderAvailableCourses(availableListEl);
    });



  listEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const removeIndex = target.dataset.removeIndex;
    if (typeof removeIndex !== "string") {
      return;
    }

    const index = Number(removeIndex);
    const item = state.schedule.classes[index];
    if (!item) {
      showStatus(statusEl, "Class no longer exists", "warn");
      return;
    }

    removeClassFromSchedule(state.schedule, item);
    saveAndRender(timetableEl, listEl, availableListEl);
    showStatus(statusEl, "Class removed", "ok");
  });

  exportBtnEl.addEventListener("click", () => {
    const jsonString = JSON.stringify(state.schedule, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = `schedule-${new Date().toISOString().split("T")[0]}.json`;

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    showStatus(statusEl, `Exported to ${filename}`, "ok");
  });

  importBtnEl.addEventListener("click", () => {
    importFileEl.click();
  });

  importFileEl.addEventListener("change", async () => {
    const file = importFileEl.files?.[0];
    if (!file) {
      return;
    }

    try {
      const jsonText = await file.text();
      const imported = JSON.parse(jsonText);

      if (!imported.classes || !Array.isArray(imported.classes)) {
        throw new Error("Invalid schedule format: missing classes array");
      }

      state.schedule = imported;
      saveAndRender(timetableEl, listEl, availableListEl);
      showStatus(statusEl, `Imported ${imported.classes.length} courses from ${file.name}`, "ok");
    } catch (error) {
      showStatus(statusEl, error.message || "Failed to import schedule", "warn");
    } finally {
      importFileEl.value = "";
    }
  });

  clearBtnEl.addEventListener("click", () => {
    state.schedule = createStudentSchedule();
    clearScheduleStorage();
    saveAndRender(timetableEl, listEl, availableListEl);
    showStatus(statusEl, "Schedule cleared", "ok");
  });

  availableSearchEl.addEventListener("input", () => {
    state.availableSearchText = availableSearchEl.value;
    renderAvailableCourses(availableListEl);
  });

  availableListEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const addKey = target.dataset.addKey;
    if (!addKey) {
      return;
    }

    const selectedClass = state.availableCourses.find((item) => classKey(item) === addKey);
    if (!selectedClass) {
      showStatus(statusEl, "Selected course no longer exists in source list", "warn");
      return;
    }

    if (!canAddInDay(state.schedule, selectedClass.classSchedule.dayOfWeek)) {
      showStatus(statusEl, `Maximum ${MAX_CLASSES_PER_DAY} classes reached for this day`, "warn");
      return;
    }

    const addResult = addClassToSchedule(state.schedule, selectedClass);
    if (!addResult.added) {
      showStatus(statusEl, "Cannot add class due to time conflict", "warn");
      return;
    }

    saveAndRender(timetableEl, listEl, availableListEl);
    showStatus(statusEl, "Class added from available list", "ok");
  });
}

bootstrapStep3UI();
