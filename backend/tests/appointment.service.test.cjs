const assert = require("node:assert/strict");
const appointmentService = require("../dist/services/appointment.service.js");
const { prisma } = require("../dist/config/database.js");

async function main() {
  console.log("Starting Doctor Appointment Unit Tests...");

  const mockAppts = [];

  prisma.appointment = {
    create: async ({ data }) => {
      const appt = {
        id: `appt_${Date.now()}_${Math.random()}`,
        reminderSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      mockAppts.push(appt);
      return appt;
    },
    findMany: async ({ where }) => {
      return mockAppts.filter((a) => {
        if (where.patientId && a.patientId !== where.patientId) return false;
        if (where.status?.in && !where.status.in.includes(a.status)) return false;
        if (where.appointmentDate?.gte && a.appointmentDate < where.appointmentDate.gte) return false;
        if (where.appointmentDate?.lte && a.appointmentDate > where.appointmentDate.lte) return false;
        return true;
      });
    },
    findFirst: async ({ where }) => {
      return mockAppts.find((a) => {
        if (where.id && a.id !== where.id) return false;
        if (where.patientId && a.patientId !== where.patientId) return false;
        return true;
      }) || null;
    },
    update: async ({ where, data }) => {
      const idx = mockAppts.findIndex((a) => a.id === where.id);
      if (idx === -1) throw new Error("Not found");
      mockAppts[idx] = { ...mockAppts[idx], ...data, updatedAt: new Date() };
      return mockAppts[idx];
    },
  };

  // Test 1: Create appointment
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const appt = await appointmentService.createAppointment("patient_001", {
    doctorName: "Dr. A. Verma",
    hospital: "Apollo Care Clinic",
    department: "Cardiology",
    appointmentDate: tomorrow,
    reason: "Routine Heart Checkup",
    notes: "Bring previous ECG reports",
  });

  assert.equal(appt.doctorName, "Dr. A. Verma");
  assert.equal(appt.status, "SCHEDULED");
  assert.equal(appt.department, "Cardiology");
  console.log("PASS Create doctor appointment with complete medical fields");

  // Test 2: Reject empty doctor name
  await assert.rejects(
    async () => {
      await appointmentService.createAppointment("patient_001", {
        doctorName: "",
        hospital: "City Hospital",
        appointmentDate: tomorrow,
        reason: "Consultation",
      });
    },
    /Doctor name is required/
  );
  console.log("PASS Validate required fields for appointment creation");

  // Test 3: Upcoming appointments query
  const upcoming = await appointmentService.getUpcomingAppointments("patient_001");
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].id, appt.id);
  console.log("PASS Filter upcoming appointments correctly");

  // Test 4: Cancel appointment
  const cancelled = await appointmentService.cancelAppointment("patient_001", appt.id);
  assert.equal(cancelled.status, "CANCELLED");
  console.log("PASS Cancel appointment safely");
}

main().catch((err) => {
  console.error("Test failure:", err);
  process.exitCode = 1;
});

