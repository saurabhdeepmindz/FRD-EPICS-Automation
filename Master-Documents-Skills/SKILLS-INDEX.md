# Master-Documents-Skills — Index

> Skills for the FRD → EPICs → UserStory automation flow.
> Each skill is a step-by-step playbook that references the corresponding Master-Documents templates and checklists.
> Execute skills in the numbered order below — each step's output is the next step's input.

---

## Execution Order

| # | Skill File | Slash Command | What It Produces | Input Required |
|---|-----------|---------------|-----------------|----------------|
| 1 | `SKILL-01-create-prd.md` | `/create-prd` | `Project-Documents/PRD-[Code].md` | Raw requirements / BRD / SOW |
| 2 | `SKILL-02-create-epics.md` | `/create-epics` | `Project-Documents/EPICs/EPIC-[NNN]-*.md` + EPIC List + PRD-EPICs RTM | Approved PRD |
| 3 | `SKILL-03-create-screens-wireframes.md` | `/create-screens-wireframes` | `Project-Documents/Screens/SCR-[NNN]-*.md` + Screen List + EPICs-Screen RTM | Approved EPICs |
| 4 | `SKILL-04-create-user-stories.md` | `/create-user-stories` | `Project-Documents/UserStories/US-[NNN]-*.md` + EPICs-Screen-UserStory RTM | Approved EPICs + Screens |
| 5 | `SKILL-05-create-subtasks.md` | `/create-subtasks` | `Project-Documents/SubTasks/ST-[US-NNN]-*.md` + UserStory-SubTask RTM | Approved User Stories |
| 6 | `SKILL-06-create-nfr.md` | `/create-nfr` | `Project-Documents/NFR-[Code].md` | Approved PRD + EPICs |
| 7 | `SKILL-07-create-ui-ux-guidelines.md` | `/create-ui-ux-guidelines` | `Project-Documents/UI-UX-Guidelines-[Code].md` | PRD + EPICs + Screens + Brand Kit |

---

## Full Flow Reference

```
Raw Requirements
      │
      ▼
  /create-prd          ──► PRD-[Code].md
      │
      ▼
  /create-epics         ──► EPIC-List, EPICs/, PRD-EPICs-RTM
      │
      ▼
  /create-screens       ──► Screen-List, Screens/, EPICs-Screen-RTM
  -wireframes
      │
      ▼
  /create-user-stories  ──► UserStories/, EPICs-Screen-UserStory-RTM
      │
      ▼
  /create-subtasks      ──► SubTasks/, UserStory-SubTask-RTM
      │
      ├──► /create-nfr                ──► NFR-[Code].md
      │    (runs in parallel with or
      │     after EPICs creation)
      │
      └──► /create-ui-ux-guidelines   ──► UI-UX-Guidelines-[Code].md
           (runs after Screens are done)
```

---

## Template → Checklist → RTM Mapping

| Skill | Template | Checklist | RTM |
|-------|----------|-----------|-----|
| PRD | PRD-Template.md | PRD-Template-Checklist.md | — |
| EPICs | EPIC-Template.md, EPIC-List-Template.md | EPIC-Template-Checklist.md | PRD-EPICs-RTM-Template.md |
| Screens | Screen-Wireframe-Template.md, Screen-List-Template.md | Screen-Wireframe-Template-Checklist.md | EPICs-Screen-RTM-Template.md |
| User Stories | UserStory-Template.md | UserStory-Template-Checklist.md | EPICs-Screen-UserStory-RTM-Template.md |
| SubTasks | SubTask-Template.md | SubTask-Template-Checklist.md | UserStory-SubTask-RTM-Template.md |
| NFR | Non-Functional-Requirements-Template.md | NFR-Template-Checklist.md | — |
| UI/UX | UI-UX-Template.md | UI-UX-Template-Checklist.md | — |

---

## Governing Flow Document

`Flow/FRD-EPICS-UserStory-Flow.md` — master sequence reference for the entire pipeline.
