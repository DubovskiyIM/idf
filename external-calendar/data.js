function generateSlots() {
  const slots = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d < 7; d++) {
    const date = new Date(today.getTime() + d * 86400000);
    const dayOfWeek = date.getDay();

    let hours;
    if (dayOfWeek === 0) continue;
    else if (dayOfWeek === 6) hours = [10, 11, 12];
    else hours = [10, 11, 12, 14, 15, 16, 17];

    const dateStr = date.toISOString().slice(0, 10);

    for (const h of hours) {
      const slotId = `slot_${dateStr}_${h}`;
      slots[slotId] = {
        id: slotId,
        specialistId: "sp_anna",
        date: dateStr,
        startTime: `${String(h).padStart(2, "0")}:00`,
        endTime: `${String(h + 1).padStart(2, "0")}:00`,
        status: "free"
      };
    }
  }

  return slots;
}

const slots = generateSlots();

function getAll() { return Object.values(slots); }
function get(id) { return slots[id] || null; }
function block(id) { if (slots[id]) { slots[id].status = "blocked"; return true; } return false; }
function unblock(id) { if (slots[id]) { slots[id].status = "free"; return true; } return false; }
function remove(id) { if (slots[id]) { delete slots[id]; return true; } return false; }

module.exports = { getAll, get, block, unblock, remove };
