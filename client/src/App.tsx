import { Route, Routes } from 'react-router-dom';
import { NotFoundPage } from './pages/LandingPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { FleetPage } from './pages/FleetPage';
import { HospitalImportPage } from './pages/HospitalImportPage';
import { DispatcherDashboardPage } from './pages/DispatcherDashboardPage';
import { RegisterEmergencyPage } from './pages/RegisterEmergencyPage';
import { PriorityQueuePage } from './pages/PriorityQueuePage';
import { AmbulanceSearchPage } from './pages/AmbulanceSearchPage';
import { HospitalMatchPage } from './pages/HospitalMatchPage';
import { HospitalResourcesPage } from './pages/HospitalResourcesPage';
import { AssignmentDeskPage } from './pages/AssignmentDeskPage';
import { HospitalDashboardPage } from './pages/HospitalDashboardPage';
import { HospitalPrebookingsPage } from './pages/HospitalPrebookingsPage';
import { HospitalCampaignsPage } from './pages/HospitalCampaignsPage';
import { PatientDashboardPage } from './pages/PatientDashboardPage';
import { PatientAmbulancePage } from './pages/PatientAmbulancePage';
import { PatientHospitalsPage } from './pages/PatientHospitalsPage';
import { PatientNotificationsPage } from './pages/PatientNotificationsPage';
import { AuthProvider } from './lib/auth';
import {
  ForbiddenPage,
  ProtectedRoute,
} from './components/layout/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dispatcher"
          element={
            <ProtectedRoute role="DISPATCHER">
              <DispatcherDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispatcher/emergency/new"
          element={
            <ProtectedRoute role="DISPATCHER">
              <RegisterEmergencyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispatcher/queue"
          element={
            <ProtectedRoute role="DISPATCHER">
              <PriorityQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispatcher/ambulances"
          element={
            <ProtectedRoute role="DISPATCHER">
              <AmbulanceSearchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispatcher/fleet"
          element={
            <ProtectedRoute role="DISPATCHER">
              <FleetPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispatcher/hospitals"
          element={
            <ProtectedRoute role="DISPATCHER">
              <HospitalMatchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispatcher/assignments"
          element={
            <ProtectedRoute role="DISPATCHER">
              <AssignmentDeskPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital"
          element={
            <ProtectedRoute role="HOSPITAL">
              <HospitalDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital/import"
          element={
            <ProtectedRoute role="HOSPITAL">
              <HospitalImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital/resources"
          element={
            <ProtectedRoute role="HOSPITAL">
              <HospitalResourcesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital/prebookings"
          element={
            <ProtectedRoute role="HOSPITAL">
              <HospitalPrebookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital/campaigns"
          element={
            <ProtectedRoute role="HOSPITAL">
              <HospitalCampaignsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient"
          element={
            <ProtectedRoute role="PATIENT">
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/ambulance"
          element={
            <ProtectedRoute role="PATIENT">
              <PatientAmbulancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/hospitals"
          element={
            <ProtectedRoute role="PATIENT">
              <PatientHospitalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/notifications"
          element={
            <ProtectedRoute role="PATIENT">
              <PatientNotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
