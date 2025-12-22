class Submission {
  constructor(data) {
    this.protocol = data.protocol;
    this.hash = data.hash;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.status = data.status || 'Recebido';
    this.cpfHash = data.cpfHash;
    this.cpfLast4 = data.cpfLast4;
    this.formVersion = data.formVersion || data.form_version || '';
    this.identified = data.identified || {}; // Personal data
    this.project = data.project || data.blind || {}; // Project data
    this.blind = data.blind || data.project || {}; // Project data (blind)
    this.adminUpdatedAt = data.adminUpdatedAt;

    // Observações internas (admin) - não faz parte do hash
    this.adminNotes = data.adminNotes;

    // Governança/auditoria (metadados + histórico de alterações)
    this.audit = data.audit || null;

    // Integridade (Plágio/IA)
    this.integrity = data.integrity || {
      status: 'not_scanned', // not_scanned, pending, processing, completed, error
      score: null, // 0-100 (Plagiarism)
      aiScore: null, // 0-100 (AI)
      reportUrl: null,
      scanId: null,
      updatedAt: null
    };
  }

  isValid() {
    // Basic validation logic
    if (!this.protocol || !this.hash || !this.cpfHash) return false;
    return true;
  }

  updateStatus(newStatus) {
    this.status = newStatus;
    this.adminUpdatedAt = new Date().toISOString();
  }
}

module.exports = Submission;
