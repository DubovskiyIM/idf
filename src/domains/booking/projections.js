export const PROJECTIONS = {
  service_catalog: {
    name: "Каталог услуг",
    query: "все активные услуги с ценами и длительностью",
    witnesses: ["name", "duration", "price", "specialist.name"]
  },
  specialist_schedule: {
    name: "Расписание",
    query: "слоты специалиста на выбранную неделю со статусами",
    witnesses: ["date", "startTime", "endTime", "status"]
  },
  my_bookings: {
    name: "Мои записи",
    query: "все записи текущего клиента, будущие и прошлые",
    witnesses: ["specialist.name", "service.name", "slot.date", "slot.startTime", "status"]
  }
};
