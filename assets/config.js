/** Site config — safe to publish except keep the token fine-grained & revocable. */
export const CONFIG = {
  owner: "Xi-Mu-Yu",
  repo: "image-edit-user-study",
  label: "submission",

  /** Shared password for raters (login). */
  studyPassword: "WhereEdit2026",

  /** Password for admin.html statistics page. */
  adminPassword: "WhereEditAdmin2026",

  /**
   * Fine-grained PAT with ONLY:
   *   Repository: Xi-Mu-Yu/image-edit-user-study
   *   Permissions: Issues = Read and write
   * Create: https://github.com/settings/personal-access-tokens/new
   * Revoke after the user study ends.
   */
  githubToken: "REPLACE_WITH_FINE_GRAINED_PAT",
};
