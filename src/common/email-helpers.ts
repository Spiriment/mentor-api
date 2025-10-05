import {
  DynamicEmailData,
  TextSection,
  ListSection,
  TableSection,
  AlertSection,
} from "./types/email.types";

export class EmailHelpers {
  /**
   * Create a text section for dynamic emails
   */
  static createTextSection(content: string, title?: string): TextSection {
    return {
      type: "text",
      title,
      content,
    };
  }

  /**
   * Create a list section for dynamic emails
   */
  static createListSection(items: string[], title?: string): ListSection {
    return {
      type: "list",
      title,
      items,
    };
  }

  /**
   * Create a table section for dynamic emails
   */
  static createTableSection(
    rows: string[][],
    headers?: string[],
    title?: string
  ): TableSection {
    return {
      type: "table",
      title,
      headers,
      rows,
    };
  }

  /**
   * Create an alert section for dynamic emails
   */
  static createAlertSection(
    content: string,
    level: "info" | "success" | "warning" | "error",
    title?: string
  ): AlertSection {
    return {
      type: "alert",
      title,
      level,
      content,
    };
  }

  /**
   * Create a complete dynamic email data structure
   */
  static createDynamicEmail(
    title: string,
    sections: Array<TextSection | ListSection | TableSection | AlertSection>
  ): DynamicEmailData {
    return {
      title,
      sections,
    };
  }

  /**
   * Example: Create a welcome email
   */
  static createWelcomeEmail(
    userName: string,
    features: string[]
  ): DynamicEmailData {
    return this.createDynamicEmail(`Welcome to Our Platform, ${userName}!`, [
      this.createTextSection(
        `Hi ${userName},<br><br>Welcome to our platform! We're excited to have you on board.`,
        "Welcome Message"
      ),
      this.createTextSection(
        "Here are some key features you can explore:",
        "Getting Started"
      ),
      this.createListSection(features),
      this.createTextSection(
        "If you have any questions, feel free to reach out to our support team.",
        "Need Help?"
      ),
    ]);
  }

  /**
   * Example: Create a report email
   */
  static createReportEmail(
    reportTitle: string,
    data: Array<Record<string, string>>
  ): DynamicEmailData {
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const rows = data.map((item) => Object.values(item));

    return this.createDynamicEmail(reportTitle, [
      this.createTextSection(
        "Please find below the requested report data:",
        "Report Summary"
      ),
      this.createTableSection(rows, headers, "Report Data"),
      this.createTextSection(
        "This report was generated automatically. Please contact support if you have any questions.",
        "Additional Information"
      ),
    ]);
  }

  /**
   * Example: Create a notification summary email
   */
  static createNotificationSummaryEmail(
    notifications: Array<{ title: string; message: string; date: string }>
  ): DynamicEmailData {
    const rows = notifications.map((n) => [n.title, n.message, n.date]);

    return this.createDynamicEmail("Notification Summary", [
      this.createTextSection(
        "You have received the following notifications:",
        "Recent Notifications"
      ),
      this.createTableSection(rows, ["Title", "Message", "Date"]),
      this.createTextSection(
        "You can view all notifications in your dashboard.",
        "View All"
      ),
    ]);
  }

  /**
   * Example: Create a system alert email
   */
  static createSystemAlertEmail(
    alertTitle: string,
    alertMessage: string,
    alertLevel: "info" | "success" | "warning" | "error"
  ): DynamicEmailData {
    return this.createDynamicEmail("System Alert", [
      this.createTextSection(
        "A system alert has been triggered that requires your attention.",
        "Alert Notification"
      ),
      this.createAlertSection(alertMessage, alertLevel, alertTitle),
      this.createTextSection(
        "Please review the alert details above and take appropriate action if necessary.",
        "Next Steps"
      ),
    ]);
  }

  /**
   * Example: Create a status update email with multiple alerts
   */
  static createStatusUpdateEmail(
    updates: Array<{
      title: string;
      message: string;
      status: "success" | "warning" | "error" | "info";
    }>
  ): DynamicEmailData {
    const sections: Array<
      TextSection | ListSection | TableSection | AlertSection
    > = [
      this.createTextSection(
        "Here's a summary of recent system updates and their status:",
        "Status Update Summary"
      ),
    ];

    // Add alert sections for each update
    updates.forEach((update) => {
      sections.push(
        this.createAlertSection(update.message, update.status, update.title)
      );
    });

    sections.push(
      this.createTextSection(
        "All updates have been processed. Please review any warnings or errors that may require attention.",
        "Summary"
      )
    );

    return this.createDynamicEmail("System Status Update", sections);
  }
}
