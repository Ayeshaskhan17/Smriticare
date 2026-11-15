import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import {
  Appointment,
  cancelAppointment,
  createAppointment,
  getAppointmentHistory,
  getUpcomingAppointments,
} from "../../services/appointment.service";

type MedicalHelpScreenProps = {
  onBack?: () => void;
};

const COLORS = {
  background: "#FBF9F1",
  surface: "#FFFFFF",
  surfaceLow: "#F1F0E7",
  surfaceVariant: "#D9DDD4",

  primary: "#3F6F45",
  primaryContainer: "#315A36",
  onPrimary: "#FFFFFF",
  onPrimaryContainer: "#D7E7D2",

  secondary: "#8A6040",
  secondaryContainer: "#E9D7C5",
  onSecondaryContainer: "#68472F",

  tertiary: "#A65D43",
  tertiaryContainer: "#E7C9B9",

  error: "#9B3F32",
  errorContainer: "#E7C9B9",
  onErrorContainer: "#7F2F27",

  text: "#1B1C17",
  textSecondary: "#565A52",

  white: "#FFFFFF",

  outline: "#72766D",
  outlineVariant: "#CDD2C8",
};

export default function MedicalHelpScreen({
  onBack,
}: MedicalHelpScreenProps) {
  const [activeTab, setActiveTab] = useState<"APPOINTMENTS" | "EMERGENCY" | "ASSISTANT">("APPOINTMENTS");
  const [message, setMessage] = useState("");

  // Appointments State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingAppt, setSubmittingAppt] = useState(false);

  // New Appointment Form State
  const [doctorName, setDoctorName] = useState("");
  const [hospital, setHospital] = useState("");
  const [department, setDepartment] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [appointmentTime, setAppointmentTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const loadAppointments = useCallback(async () => {
    try {
      setLoadingAppts(true);
      const data = showHistory
        ? await getAppointmentHistory()
        : await getUpcomingAppointments();
      setAppointments(data);
    } catch (err: any) {
      console.warn("Could not load appointments:", err.message);
    } finally {
      setLoadingAppts(false);
    }
  }, [showHistory]);

  useEffect(() => {
    if (activeTab === "APPOINTMENTS") {
      loadAppointments();
    }
  }, [activeTab, loadAppointments]);

  const handleCreateAppointment = async () => {
    if (!doctorName.trim() || !hospital.trim() || !reason.trim()) {
      Alert.alert("Missing Details", "Please fill in Doctor Name, Hospital/Clinic, and Reason for visit.");
      return;
    }

    try {
      setSubmittingAppt(true);
      const combinedDate = new Date(`${appointmentDate}T${appointmentTime}:00`);

      await createAppointment({
        doctorName: doctorName.trim(),
        hospital: hospital.trim(),
        department: department.trim() || undefined,
        appointmentDate: combinedDate,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });

      setShowAddModal(false);
      setDoctorName("");
      setHospital("");
      setDepartment("");
      setReason("");
      setNotes("");
      Alert.alert("Success", "Doctor appointment scheduled successfully! Reminder email will be sent automatically.");
      loadAppointments();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to schedule appointment");
    } finally {
      setSubmittingAppt(false);
    }
  };

  const handleCancelAppointment = (id: string, name: string) => {
    Alert.alert(
      "Cancel Appointment",
      `Are you sure you want to cancel your appointment with Dr. ${name}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelAppointment(id);
              Alert.alert("Cancelled", "Appointment has been cancelled.");
              loadAppointments();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to cancel appointment");
            }
          },
        },
      ]
    );
  };

  const handleQuickAction = (action: string) => {
    setMessage(action);
  };

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    Alert.alert("SmritiCare Assistant", `You asked:\n\n${trimmedMessage}\n\nOur healthcare team and your connected caregivers have been notified.`);
    setMessage("");
  };

  const handleCallHospital = () => {
    Alert.alert("Call Hospital", "Connecting directly to City General Hospital Emergency Desk (Tel: +91-9876543210)...");
  };

  const handleNearbyCenters = () => {
    Alert.alert(
      "Verified Care Centers Nearby",
      "1. Apollo Medical Center (1.2 km)\n2. Max Healthcare Clinic (2.4 km)\n3. City Elder Wellness Center (3.1 km)\n\nDirections and contact details are available."
    );
  };

  const handleSOS = () => {
    Alert.alert(
      "SOS EMERGENCY ALERT",
      "Immediate alert will be dispatched to your family members, emergency contacts, and professional caregivers with your current GPS location.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "CONFIRM SOS",
          style: "destructive",
          onPress: () => {
            Alert.alert("SOS Dispatched", "Care circle alerted successfully via SMS and Email.");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Healthcare & Medical</Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setActiveTab("APPOINTMENTS")}
            style={[styles.tabButton, activeTab === "APPOINTMENTS" && styles.tabButtonActive]}
          >
            <MaterialIcons
              name="event"
              size={22}
              color={activeTab === "APPOINTMENTS" ? COLORS.white : COLORS.primary}
            />
            <Text
              style={[styles.tabText, activeTab === "APPOINTMENTS" && styles.tabTextActive]}
            >
              Appointments
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("EMERGENCY")}
            style={[styles.tabButton, activeTab === "EMERGENCY" && styles.tabButtonActive]}
          >
            <MaterialIcons
              name="local-hospital"
              size={22}
              color={activeTab === "EMERGENCY" ? COLORS.white : COLORS.error}
            />
            <Text
              style={[styles.tabText, activeTab === "EMERGENCY" && styles.tabTextActive]}
            >
              Emergency Care
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("ASSISTANT")}
            style={[styles.tabButton, activeTab === "ASSISTANT" && styles.tabButtonActive]}
          >
            <MaterialIcons
              name="smart-toy"
              size={22}
              color={activeTab === "ASSISTANT" ? COLORS.white : COLORS.secondary}
            />
            <Text
              style={[styles.tabText, activeTab === "ASSISTANT" && styles.tabTextActive]}
            >
              Assistant
            </Text>
          </Pressable>
        </View>

        {/* TAB 1: DOCTOR APPOINTMENTS */}
        {activeTab === "APPOINTMENTS" && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>
                  {showHistory ? "Appointment History" : "Upcoming Visits"}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {showHistory
                    ? "Past completed and cancelled visits"
                    : "Scheduled consultations with reminders"}
                </Text>
              </View>

              <Pressable
                style={styles.toggleHistoryButton}
                onPress={() => setShowHistory(!showHistory)}
              >
                <Text style={styles.toggleHistoryText}>
                  {showHistory ? "Show Upcoming" : "Show History"}
                </Text>
              </Pressable>
            </View>

            {/* Action to add appointment */}
            <Pressable
              style={({ pressed }) => [
                styles.addApptButton,
                pressed && styles.pressed,
              ]}
              onPress={() => setShowAddModal(true)}
            >
              <MaterialIcons name="add" size={26} color={COLORS.white} />
              <Text style={styles.addApptText}>Schedule Doctor Appointment</Text>
            </Pressable>

            {loadingAppts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading appointments...</Text>
              </View>
            ) : appointments.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="event-available" size={48} color={COLORS.outline} />
                <Text style={styles.emptyTitle}>
                  {showHistory ? "No Past Appointments" : "No Upcoming Appointments"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {showHistory
                    ? "Completed visits will be recorded here."
                    : "Tap 'Schedule Doctor Appointment' above to record your next medical visit."}
                </Text>
              </View>
            ) : (
              appointments.map((appt) => {
                const dateObj = new Date(appt.appointmentDate);
                const dateStr = dateObj.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                const timeStr = dateObj.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <View key={appt.id} style={styles.apptCard}>
                    <View style={styles.apptHeaderRow}>
                      <View style={styles.apptIconBox}>
                        <MaterialIcons name="person" size={26} color={COLORS.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.apptDoctor}>Dr. {appt.doctorName}</Text>
                        <Text style={styles.apptDepartment}>
                          {appt.department || "General Consultation"} • {appt.hospital}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          appt.status === "SCHEDULED"
                            ? styles.statusScheduled
                            : appt.status === "COMPLETED"
                            ? styles.statusCompleted
                            : styles.statusCancelled,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>{appt.status}</Text>
                      </View>
                    </View>

                    <View style={styles.apptDetailRow}>
                      <MaterialIcons name="schedule" size={18} color={COLORS.secondary} />
                      <Text style={styles.apptDetailText}>
                        {dateStr} at {timeStr}
                      </Text>
                    </View>

                    <View style={styles.apptDetailRow}>
                      <MaterialIcons name="medical-services" size={18} color={COLORS.secondary} />
                      <Text style={styles.apptDetailText}>Reason: {appt.reason}</Text>
                    </View>

                    {appt.notes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesText}>Notes: {appt.notes}</Text>
                      </View>
                    ) : null}

                    {appt.status === "SCHEDULED" && (
                      <View style={styles.apptActionRow}>
                        <Pressable
                          style={styles.cancelApptButton}
                          onPress={() => handleCancelAppointment(appt.id, appt.doctorName)}
                        >
                          <MaterialIcons name="close" size={18} color={COLORS.error} />
                          <Text style={styles.cancelApptText}>Cancel Appointment</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* TAB 2: EMERGENCY CARE */}
        {activeTab === "EMERGENCY" && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Emergency warning */}
            <View style={styles.warningBox}>
              <MaterialIcons name="warning" size={26} color={COLORS.error} />
              <Text style={styles.emergencyWarning}>
                For critical life-threatening conditions, trigger SOS immediately or call emergency dispatch.
              </Text>
            </View>

            {/* Hospital Card */}
            <View style={styles.hospitalCard}>
              <View style={styles.hospitalHeader}>
                <View style={styles.hospitalIcon}>
                  <MaterialIcons name="local-hospital" size={32} color={COLORS.error} />
                </View>
                <View style={styles.hospitalInfo}>
                  <Text style={styles.hospitalTitle}>City General Hospital</Text>
                  <View style={styles.locationRow}>
                    <MaterialIcons name="location-on" size={19} color={COLORS.secondary} />
                    <Text style={styles.locationText}>1.2 km away • Emergency 24/7</Text>
                  </View>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.callHospitalButton,
                  pressed && styles.callButtonPressed,
                ]}
                onPress={handleCallHospital}
              >
                <MaterialIcons name="call" size={26} color={COLORS.onPrimary} />
                <Text style={styles.callHospitalText}>Direct Hospital Emergency Call</Text>
              </Pressable>
            </View>

            {/* Secondary actions */}
            <View style={styles.secondaryGrid}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryCard,
                  pressed && styles.secondaryPressed,
                ]}
                onPress={handleNearbyCenters}
              >
                <View style={styles.secondaryIcon}>
                  <MaterialIcons name="map" size={36} color={COLORS.primary} />
                </View>
                <Text style={styles.secondaryCardText}>Nearby Care Centers</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.secondaryCard,
                  styles.sosCard,
                  pressed && styles.sosPressed,
                ]}
                onPress={handleSOS}
              >
                <View style={styles.sosIcon}>
                  <MaterialIcons name="sos" size={36} color={COLORS.error} />
                </View>
                <Text style={styles.sosText}>SOS Caregiver Alert</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {/* TAB 3: ASSISTANT */}
        {activeTab === "ASSISTANT" && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.assistantCard}>
              <View style={styles.topAccent} />
              <View style={styles.assistantIcon}>
                <MaterialIcons name="smart-toy" size={30} color={COLORS.onPrimaryContainer} />
              </View>
              <View style={styles.assistantText}>
                <Text style={styles.assistantTitle}>SmritiCare Healthcare Assistant</Text>
                <Text style={styles.assistantMessage}>
                  Hello! How are you feeling today? Tap a quick option or describe your symptoms below.
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Common Health Inquiries</Text>
              <View style={styles.chipsContainer}>
                <Pressable
                  style={styles.chip}
                  onPress={() => handleQuickAction("I have a headache")}
                >
                  <MaterialIcons name="sick" size={22} color={COLORS.primary} />
                  <Text style={styles.chipText}>I have a headache</Text>
                </Pressable>

                <Pressable
                  style={styles.chip}
                  onPress={() => handleQuickAction("Feeling dizzy or lightheaded")}
                >
                  <MaterialIcons name="screen-rotation" size={22} color={COLORS.primary} />
                  <Text style={styles.chipText}>Feeling dizzy</Text>
                </Pressable>

                <Pressable
                  style={styles.chip}
                  onPress={() => handleQuickAction("Check my medication side effects")}
                >
                  <MaterialIcons name="medication" size={22} color={COLORS.primary} />
                  <Text style={styles.chipText}>Medication guidance</Text>
                </Pressable>
              </View>
            </View>

            {/* Chat input */}
            <View style={styles.chatArea}>
              <View style={styles.chatRow}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Describe your symptoms or question..."
                  placeholderTextColor={COLORS.outline}
                  style={styles.chatInput}
                  multiline
                  maxLength={500}
                />
                <Pressable style={styles.sendButton} onPress={handleSend}>
                  <MaterialIcons name="send" size={26} color={COLORS.white} />
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {/* MODAL: ADD DOCTOR APPOINTMENT */}
        <Modal
          visible={showAddModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Schedule Doctor Visit</Text>
                <Pressable onPress={() => setShowAddModal(false)}>
                  <MaterialIcons name="close" size={26} color={COLORS.text} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Doctor Name *</Text>
                <TextInput
                  value={doctorName}
                  onChangeText={setDoctorName}
                  placeholder="e.g. Dr. Ramesh Kumar"
                  placeholderTextColor={COLORS.outline}
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>Hospital or Clinic *</Text>
                <TextInput
                  value={hospital}
                  onChangeText={setHospital}
                  placeholder="e.g. Apollo Care Hospital"
                  placeholderTextColor={COLORS.outline}
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>Department / Specialty</Text>
                <TextInput
                  value={department}
                  onChangeText={setDepartment}
                  placeholder="e.g. Cardiology, Orthopedics, General"
                  placeholderTextColor={COLORS.outline}
                  style={styles.textInput}
                />

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.fieldLabel}>Date (YYYY-MM-DD) *</Text>
                    <TextInput
                      value={appointmentDate}
                      onChangeText={setAppointmentDate}
                      placeholder="2026-11-20"
                      placeholderTextColor={COLORS.outline}
                      style={styles.textInput}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.fieldLabel}>Time (HH:MM) *</Text>
                    <TextInput
                      value={appointmentTime}
                      onChangeText={setAppointmentTime}
                      placeholder="10:30"
                      placeholderTextColor={COLORS.outline}
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Reason for Appointment *</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Regular BP review and blood work"
                  placeholderTextColor={COLORS.outline}
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>Notes / Preparation Instructions</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Fasting 10 hours before test, carry reports"
                  placeholderTextColor={COLORS.outline}
                  style={[styles.textInput, { height: 70 }]}
                  multiline
                />

                <Pressable
                  style={[styles.saveModalButton, submittingAppt && styles.disabledButton]}
                  onPress={handleCreateAppointment}
                  disabled={submittingAppt}
                >
                  {submittingAppt ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveModalButtonText}>Save & Enable Email Reminder</Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    minHeight: 70,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    minWidth: 90,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pressed: {
    opacity: 0.75,
  },
  backText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primary,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 14,
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLow,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.white,
    fontWeight: "800",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  toggleHistoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLow,
  },
  toggleHistoryText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  addApptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 8,
  },
  addApptText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
  },
  loadingContainer: {
    padding: 30,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textSecondary,
  },
  emptyCard: {
    padding: 30,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  apptCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  apptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  apptIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },
  apptDoctor: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },
  apptDepartment: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusScheduled: {
    backgroundColor: "#E7EFE3",
  },
  statusCompleted: {
    backgroundColor: "#D9DDD4",
  },
  statusCancelled: {
    backgroundColor: "#FFDAD6",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.text,
  },
  apptDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  apptDetailText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
  },
  notesBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: COLORS.surfaceLow,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  apptActionRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLow,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cancelApptButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelApptText: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: "700",
  },
  warningBox: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.errorContainer,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 10,
  },
  emergencyWarning: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: COLORS.onErrorContainer,
  },
  hospitalCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    marginBottom: 16,
  },
  hospitalHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  hospitalIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FFDAD6",
    alignItems: "center",
    justifyContent: "center",
  },
  hospitalInfo: {
    flex: 1,
    marginLeft: 14,
  },
  hospitalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  callHospitalButton: {
    marginTop: 16,
    backgroundColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  callButtonPressed: {
    opacity: 0.85,
  },
  callHospitalText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },
  secondaryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  secondaryPressed: {
    opacity: 0.8,
  },
  secondaryIcon: {
    marginBottom: 8,
  },
  secondaryCardText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  sosCard: {
    borderColor: COLORS.error,
    backgroundColor: "#FFF5F5",
  },
  sosPressed: {
    backgroundColor: "#FFE5E5",
  },
  sosIcon: {
    marginBottom: 8,
  },
  sosText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.error,
    textAlign: "center",
  },
  assistantCard: {
    position: "relative",
    overflow: "hidden",
    padding: 18,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  topAccent: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    backgroundColor: COLORS.primary,
  },
  assistantIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  assistantText: {
    flex: 1,
    marginLeft: 12,
  },
  assistantTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.primary,
  },
  assistantMessage: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: 16,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  chatArea: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatInput: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: COLORS.text,
  },
  row: {
    flexDirection: "row",
  },
  saveModalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveModalButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
  },
});
