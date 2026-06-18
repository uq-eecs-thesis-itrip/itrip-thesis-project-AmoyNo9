# Xiamen 100 POI JSON Seed Dataset

This folder contains 100 JSON files for real Xiamen tourism POIs using the STCF-RAG-friendly schema.

Important fields added for route-structure control:
- `pinyin`, `aliases`: supports Chinese/English/Pinyin matching.
- `area`: supports area-based day assignment.
- `parent_poi`, `is_area_poi`, `is_sub_poi`: supports parent/sub-POI duplicate control.
- `route_role`: supports scenario quotas and time-slot preference.
- `route_constraints`: supports same-area grouping and route-level constraints.

Note: These are prototype seed values. Opening hours, coordinates, ticket requirements and ratings should be verified with Amap or official sources before production use.
