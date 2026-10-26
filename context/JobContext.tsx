"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  Job,
  JobApplication,
  ApplicationStatus,
  ContactMessage,
} from "@/types";
import {
  createJobInFirestore,
  getJobsFromFirestore,
  updateJobInFirestore,
  deleteJobInFirestore,
  createApplicationInFirestore,
  getApplicationsFromFirestore,
  deleteApplicationInFirestore,
  updateApplicationStatusInFirestore,
  saveContactMessageToFirestore,
  getContactMessagesFromFirestore,
  subscribeToJobs,
  subscribeToApplications,
  subscribeToContactMessages,
} from "@/lib/firestore";

interface JobContextType {
  jobs: Job[];
  applications: (JobApplication & Record<string, any>)[];
  contactMessages: ContactMessage[];
  loading: boolean;
  refreshJobs: () => Promise<void>;
  refreshApplications: () => Promise<void>;
  refreshContactMessages: () => Promise<void>;
  addJob: (job: Omit<Job, "id" | "postedDate">) => Promise<string>;
  updateJob: (id: string, updatedJob: Partial<Job>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  getJobById: (id: string) => Job | undefined;
  applyForJob: (
    applicationData: Omit<JobApplication, "id" | "appliedAt" | "status"> & {
      id?: string;
    }
  ) => Promise<string>;
  updateApplicationStatus: (
    applicationId: string,
    status: ApplicationStatus,
    feedback?: string
  ) => Promise<void>;
  submitContactMessage: (
    messageData: Omit<ContactMessage, "id" | "submittedAt">
  ) => Promise<string>;
  getCandidateApplications: (identifier: string) => (JobApplication & Record<string, any>)[];
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<(JobApplication & Record<string, any>)[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Fetch jobs directly from Firestore (no API endpoint)
  const refreshJobs = useCallback(async () => {
    try {
      const fetched = await getJobsFromFirestore();
      setJobs(fetched);
    } catch (err) {
      console.warn("Direct Firestore jobs fetch notice:", err);
    }
  }, []);

  // 2. Fetch applications directly from Firestore (no API endpoint)
  const refreshApplications = useCallback(async () => {
    try {
      const fetched = await getApplicationsFromFirestore();
      setApplications(fetched);
    } catch (err) {
      console.warn("Direct Firestore applications fetch notice:", err);
    }
  }, []);

  // 3. Fetch contact messages directly from Firestore (no API endpoint)
  const refreshContactMessages = useCallback(async () => {
    try {
      const fetched = await getContactMessagesFromFirestore();
      setContactMessages(fetched);
    } catch (err) {
      console.warn("Direct Firestore contact messages fetch notice:", err);
    }
  }, []);

  // 4. Set up real-time Firestore subscriptions directly via lib/firestore
  useEffect(() => {
    // Initial fetch
    refreshJobs().finally(() => setLoading(false));
    refreshApplications();
    refreshContactMessages();

    // Real-time live subscriptions
    const unsubJobs = subscribeToJobs((liveJobs) => {
      setJobs(liveJobs);
      setLoading(false);
    });

    const unsubApps = subscribeToApplications((liveApps) => {
      setApplications(liveApps);
    });

    const unsubMsgs = subscribeToContactMessages((liveMsgs) => {
      setContactMessages(liveMsgs);
    });

    return () => {
      unsubJobs();
      unsubApps();
      unsubMsgs();
    };
  }, [refreshJobs, refreshApplications, refreshContactMessages]);

  // 5. Create Job directly in Firestore (no API endpoint)
  const addJob = async (
    jobData: Omit<Job, "id" | "postedDate">
  ): Promise<string> => {
    const id = "job-" + Date.now();
    const newJob: Job = {
      ...jobData,
      id,
      postedDate: new Date().toISOString().split("T")[0],
      status: jobData.status || "active",
    };

    try {
      await createJobInFirestore(newJob);
    } catch (err) {
      console.warn("createJobInFirestore notice:", err);
    }

    setJobs((prev) => [newJob, ...prev.filter((j) => j.id !== id)]);
    return id;
  };

  // 6. Update Job directly in Firestore (no API endpoint)
  const updateJob = async (id: string, updatedJob: Partial<Job>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...updatedJob } : j))
    );

    try {
      await updateJobInFirestore(id, updatedJob);
    } catch (err) {
      console.warn("updateJobInFirestore notice:", err);
    }
  };

  // 7. Delete Job directly in Firestore (no API endpoint)
  const deleteJob = async (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));

    try {
      await deleteJobInFirestore(id);
    } catch (err) {
      console.warn("deleteJobInFirestore notice:", err);
    }
  };

  const getJobById = (id: string) => {
    return jobs.find((job) => job.id === id);
  };

  // 8. Submit Application directly to Firestore (no API endpoint)
  const applyForJob = async (
    applicationData: Omit<JobApplication, "id" | "appliedAt" | "status"> & {
      id?: string;
    }
  ): Promise<string> => {
    // One-role restriction guard:
    // Candidate can apply for only one role at a time.
    // If their application is Rejected, they can apply for a new role.
    // If their application is Pending or Approved, they cannot apply for a new role.
    let candidateApps = getCandidateApplications(applicationData.uid);
    if (!candidateApps || candidateApps.length === 0) {
      try {
        candidateApps = await getApplicationsFromFirestore(applicationData.uid);
      } catch (fetchErr) {
        console.warn("Could not fetch applications from Firestore:", fetchErr);
      }
    }

    const blockingApp = candidateApps.find((app) => {
      const s = String(app.status || "").toLowerCase();
      return s === "pending" || s === "approved" || s === "offer extended";
    });

    if (blockingApp) {
      const isApproved =
        blockingApp.status === "Approved" ||
        String(blockingApp.status).toLowerCase() === "approved";
      const statusLabel = isApproved ? "Approved" : "Pending";
      throw new Error(
        `You already have an application with status "${statusLabel}". Candidates can only apply for a new role if their existing application is Rejected.`
      );
    }

    const id = applicationData.id || "app-" + Math.floor(1000 + Math.random() * 9000);
    const newApplication: JobApplication = {
      id,
      jobId: applicationData.jobId,
      uid: applicationData.uid,
      experienceYears: applicationData.experienceYears,
      description: applicationData.description,
      status: "Pending",
      appliedAt: new Date().toISOString(),
      feedback: applicationData.feedback || undefined,
      resumeUrl: (applicationData as any).resumeUrl || undefined,
      resumeFileName: (applicationData as any).resumeFileName || undefined,
    };

    try {
      await createApplicationInFirestore(newApplication);
    } catch (err) {
      console.error("createApplicationInFirestore notice:", err);
      throw err;
    }

    setApplications((prev) => [
      newApplication,
      ...prev.filter((a) => a.id !== id),
    ]);
    return id;
  };

  // 9. Update Application Status directly in Firestore (no API endpoint)
  const updateApplicationStatus = async (
    applicationId: string,
    status: ApplicationStatus,
    feedback?: string
  ) => {

    setApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId
          ? {
              ...app,
              status,
              feedback: feedback !== undefined ? feedback : app.feedback,
            }
          : app
      )
    );

    try {
      await updateApplicationStatusInFirestore(applicationId, status, feedback);
    } catch (err) {
      console.warn("updateApplicationStatusInFirestore notice:", err);
    }
  };

  // 10. Delete Application directly in Firestore
  const deleteApplication = async (id: string) => {
    setApplications((prev) => prev.filter((app) => app.id !== id));
    try {
      await deleteApplicationInFirestore(id);
    } catch (err) {
      console.warn("deleteApplicationInFirestore notice:", err);
    }
  };

  // 11. Submit Contact Inquiry directly to Firestore (no API endpoint)
  const submitContactMessage = async (
    messageData: Omit<ContactMessage, "id" | "submittedAt">
  ): Promise<string> => {
    const id = "msg-" + Date.now();
    const newMsg: ContactMessage = {
      ...messageData,
      id,
      submittedAt: new Date().toISOString(),
    };

    try {
      await saveContactMessageToFirestore(newMsg);
    } catch (err) {
      console.warn("saveContactMessageToFirestore notice:", err);
    }

    setContactMessages((prev) => [newMsg, ...prev]);
    return id;
  };

  const getCandidateApplications = (identifier: string) => {
    if (!identifier) return [];
    const lower = identifier.toLowerCase();
    return applications.filter(
      (app) =>
        app.uid === identifier ||
        (app as any).candidateEmail?.toLowerCase() === lower
    );
  };

  return (
    <JobContext.Provider
      value={{
        jobs,
        applications,
        contactMessages,
        loading,
        refreshJobs,
        refreshApplications,
        refreshContactMessages,
        addJob,
        updateJob,
        deleteJob,
        deleteApplication,
        getJobById,
        applyForJob,
        updateApplicationStatus,
        submitContactMessage,
        getCandidateApplications,
      }}
    >
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error("useJobs must be used within a JobProvider");
  }
  return context;
};
