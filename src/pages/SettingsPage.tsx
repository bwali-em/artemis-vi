import { useState, useEffect } from "react";
import { useMedicalData } from "../hooks/useMedicalData";
import { User, Stethoscope, Shield, Bell, Palette, Eye } from "lucide-react";

interface SettingsFormData {
  name: string;
  crewId: string;
  missionName: string;
  missionRole: string;
  missionStatus: string;
  email: string;
  phone: string;
  emergencyContact: string;
  bloodType: string;
  allergies: string;
  medications: string;
  medicalConditions: string;
}

const INITIAL_FORM: SettingsFormData = {
  name: "",
  crewId: "",
  missionName: "",
  missionRole: "",
  missionStatus: "",
  email: "",
  phone: "",
  emergencyContact: "",
  bloodType: "",
  allergies: "",
  medications: "",
  medicalConditions: "",
};

export function SettingsPage() {
  const { astronauts, selectedAstronautId, setSelectedAstronautId } = useMedicalData();
  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "notifications" | "security">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<SettingsFormData>(INITIAL_FORM);
  const [saved, setSaved] = useState(false);

  // Load selected astronaut data into form
  useEffect(() => {
    const astronaut = astronauts.find((a) => a.id === selectedAstronautId);
    if (astronaut) {
      setFormData((prev) => ({
        ...prev,
        name: astronaut.name,
        crewId: astronaut.crewId,
        missionName: astronaut.missionName,
        missionRole: astronaut.missionRole,
        missionStatus: astronaut.missionStatus,
      }));
    }
  }, [astronauts, selectedAstronautId]);

  const handleChange = (field: keyof SettingsFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    // In a real app, this would save to a backend
    console.log("[Settings] Saving profile:", formData);
    setSaved(true);
    setIsEditing(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = () => {
    // Reload from selected astronaut
    const astronaut = astronauts.find((a) => a.id === selectedAstronautId);
    if (astronaut) {
      setFormData((prev) => ({
        ...prev,
        name: astronaut.name,
        crewId: astronaut.crewId,
        missionName: astronaut.missionName,
        missionRole: astronaut.missionRole,
        missionStatus: astronaut.missionStatus,
      }));
    }
    setIsEditing(false);
  };

  return (
    <div className="min-h-[100svh] bg-ARTEMIS-navy text-white">
      <header className="border-b border-ARTEMIS-border/60 bg-black/40 px-5 py-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300 text-slate-950"><Stethoscope size={20} strokeWidth={2.5} /></div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ARTEMIS-cyan">Medical operations / settings</p>
            <h1 className="text-xl font-semibold text-white">Settings</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedAstronautId || ""}
            onChange={(e) => setSelectedAstronautId(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400/50"
          >
            {astronauts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="flex-1 p-5 sm:p-8">
        {/* Tab Navigation */}
        <div className="mb-8 border-b border-white/10">
          <nav className="flex gap-6" aria-label="Settings tabs">
            {[
              { id: "profile", label: "Profile", icon: User },
              { id: "preferences", label: "Preferences", icon: Palette },
              { id: "notifications", label: "Notifications", icon: Bell },
              { id: "security", label: "Security", icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium transition border-b-2 ${activeTab === tab.id ? "border-cyan-400 text-cyan-300" : "border-transparent text-slate-500 hover:text-white"}`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="max-w-3xl">
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-black/40 rounded-xl border border-white/10">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center text-slate-950">
                  <User size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{formData.name || "Select astronaut"}</h2>
                  <p className="text-sm text-slate-400">{formData.crewId}</p>
                  <p className="text-xs text-slate-500">{formData.missionName} · {formData.missionRole}</p>
                </div>
              </div>

              <div className="bg-[#0d1b2b]/80 backdrop-blur-sm rounded-2xl border border-white/10 p-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Personal Information</h3>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button onClick={handleCancel} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-sm">
                        Cancel
                      </button>
                      <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300 text-sm font-medium">
                        {saved ? "Saved!" : "Save Changes"}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditing(true)} className="px-4 py-2 rounded-lg bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30 text-sm">
                      Edit Profile
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full Name" value={formData.name} onChange={(v) => handleChange("name", v)} disabled={!isEditing} Icon={User} />
                  <Field label="Crew ID" value={formData.crewId} onChange={(v) => handleChange("crewId", v)} disabled={!isEditing} Icon={Shield} />
                  <Field label="Mission" value={formData.missionName} onChange={(v) => handleChange("missionName", v)} disabled={!isEditing} Icon={Stethoscope} />
                  <Field label="Role" value={formData.missionRole} onChange={(v) => handleChange("missionRole", v)} disabled={!isEditing} Icon={User} />
                  <Field label="Mission Status" value={formData.missionStatus} onChange={(v) => handleChange("missionStatus", v)} disabled={!isEditing} Icon={Bell} />
                  <Field label="Email" value={formData.email} onChange={(v) => handleChange("email", v)} disabled={!isEditing} type="email" />
                  <Field label="Phone" value={formData.phone} onChange={(v) => handleChange("phone", v)} disabled={!isEditing} type="tel" />
                  <Field label="Emergency Contact" value={formData.emergencyContact} onChange={(v) => handleChange("emergencyContact", v)} disabled={!isEditing} />
                </div>
              </div>

              <div className="bg-[#0d1b2b]/80 backdrop-blur-sm rounded-2xl border border-white/10 p-5 sm:p-6">
                <h3 className="text-lg font-semibold mb-6">Medical Information</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Blood Type" value={formData.bloodType} onChange={(v) => handleChange("bloodType", v)} disabled={!isEditing} />
                  <Field label="Allergies" value={formData.allergies} onChange={(v) => handleChange("allergies", v)} disabled={!isEditing} multiline />
                  <Field label="Current Medications" value={formData.medications} onChange={(v) => handleChange("medications", v)} disabled={!isEditing} multiline />
                  <Field label="Medical Conditions" value={formData.medicalConditions} onChange={(v) => handleChange("medicalConditions", v)} disabled={!isEditing} multiline />
                </div>
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div className="bg-[#0d1b2b]/80 backdrop-blur-sm rounded-2xl border border-white/10 p-5 sm:p-6">
                <h3 className="text-lg font-semibold mb-6">Display Preferences</h3>
                <div className="space-y-4">
                  <Toggle label="Dark Mode" description="Use dark theme throughout the app" defaultChecked />
                  <Toggle label="Compact Mode" description="Reduce spacing for dense information display" />
                  <Toggle label="Animations" description="Enable UI animations and transitions" defaultChecked />
                  <Toggle label="High Contrast" description="Increase contrast for better visibility" />
                </div>
              </div>
              <div className="bg-[#0d1b2b]/80 backdrop-blur-sm rounded-2xl border border-white/10 p-5 sm:p-6">
                <h3 className="text-lg font-semibold mb-6">Units & Measurements</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Temperature" options={["Celsius (°C)", "Fahrenheit (°F)"]} defaultValue="Celsius (°C)" />
                  <SelectField label="Weight" options={["Kilograms (kg)", "Pounds (lbs)"]} defaultValue="Kilograms (kg)" />
                  <SelectField label="Height" options={["Centimeters (cm)", "Feet/Inches"]} defaultValue="Centimeters (cm)" />
                  <SelectField label="Distance" options={["Metric (km/m)", "Imperial (mi/ft)"]} defaultValue="Metric (km/m)" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="bg-[#0d1b2b]/80 backdrop-blur-sm rounded-2xl border border-white/10 p-5 sm:p-6">
                <h3 className="text-lg font-semibold mb-6">Notification Preferences</h3>
                <div className="space-y-4">
                  <Toggle label="Assessment Reminders" description="Get notified when assessments are due" defaultChecked />
                  <Toggle label="Health Alerts" description="Receive critical health notifications" defaultChecked />
                  <Toggle label="Weekly Reports" description="Receive weekly health summary reports" />
                  <Toggle label="Mission Updates" description="Get notified about mission status changes" defaultChecked />
                </div>
              </div>
              <div className="bg-[#0d1b2b]/80 backdrop-blur-sm rounded-2xl border border-white/10 p-5 sm:p-6">
                <h3 className="text-lg font-semibold mb-6">Delivery Methods</h3>
                <div className="space-y-4">
                  <Toggle label="In-App" description="Show notifications within the application" defaultChecked />
                  <Toggle label="Email" description="Send notifications to registered email" />
                  <Toggle label="Push" description="Send push notifications to device" defaultChecked />
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="bg-[#0d1b2b]/80 backdrop-blur-sm rounded-2xl border border-white/10 p-5 sm:p-6">
                <h3 className="text-lg font-semibold mb-6">Account Security</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <Shield className="text-cyan-300" size={20} />
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-slate-400">Add an extra layer of security</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 rounded-lg bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30 text-sm">Enable</button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <Eye className="text-cyan-300" size={20} />
                      <div>
                        <p className="font-medium">Session Timeout</p>
                        <p className="text-sm text-slate-400">Auto-logout after inactivity</p>
                      </div>
                    </div>
                    <SelectField label="" options={["15 min", "30 min", "1 hour", "4 hours", "Never"]} defaultValue="30 min" />
                  </div>
                </div>
              </div>
              <div className="bg-[#0d1b2b]/80 backdrop-blur-sm rounded-2xl border border-white/10 p-5 sm:p-6">
                <h3 className="text-lg font-semibold mb-6">Data & Privacy</h3>
                <div className="space-y-4">
                  <Toggle label="Data Collection" description="Allow anonymous usage analytics" defaultChecked />
                  <Toggle label="Crash Reports" description="Automatically send crash reports" defaultChecked />
                  <Toggle label="Health Data Sync" description="Sync health data with mission control" />
                  <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <Shield className="text-rose-300" size={20} />
                      <div>
                        <p className="font-medium">Delete All Data</p>
                        <p className="text-sm text-slate-400">Permanently remove all personal data</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 text-sm">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, disabled, type = "text", multiline, Icon }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; type?: string; multiline?: boolean; Icon?: React.ComponentType<{ size?: number }> }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1">
        {Icon && <Icon size={10} />}
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className={`bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 resize-none ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
      )}
    </div>
  );
}

function Toggle({ label, description, defaultChecked }: { label: string; description: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked || false);
  return (
    <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/10">
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-cyan-400" : "bg-white/10"}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 transition-transform ${checked ? "left-5" : "left-0.5"} h-5 w-5 rounded-full bg-white shadow`} />
      </button>
    </div>
  );
}

function SelectField({ label, options, defaultValue }: { label: string; options: string[]; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</label>}
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400/50"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}