export const domainConfig = {
  appId: 'pisastyle',
  appName: 'PISAStyle by SWAL',
  instanceId: 'default',
  entities: [
    {
        name: "pisa_unit",
        label: "Unidad PISA",
        fields: [
            "unit_id",
            "domain",
            "process",
            "content",
            "context",
            "proficiency_level",
            "stimulus_ref",
            "locale",
            "protocol_version",
            "status"
        ],
        xavierKind: "pisa_unit"
    },
    {
        name: "study_content",
        label: "Contenido de estudio",
        fields: [
            "unit_id",
            "locale",
            "body_ref",
            "study_minutes",
            "sources",
            "protocol_version",
            "status"
        ],
        xavierKind: "study_content"
    },
    {
        name: "exam_attempt",
        label: "Intento de examen",
        fields: [
            "attempt_hash",
            "unit_id",
            "score",
            "instance_ref",
            "locale",
            "status"
        ],
        xavierKind: "exam_attempt"
    },
    {
        name: "infographic",
        label: "Infografia",
        fields: [
            "slug",
            "kind",
            "locale",
            "dataset_ref",
            "status"
        ],
        xavierKind: "infographic"
    },
    {
        name: "telemetry_event",
        label: "Evento telemetria",
        fields: [
            "event_type",
            "unit_id",
            "locale",
            "duration_ms",
            "instance_ref",
            "status"
        ],
        xavierKind: "telemetry_event"
    }
],
  aui: {
    enabled: true,
    allowAgentTheme: true,
  },
} as const;
export type DomainConfig = typeof domainConfig;
