extends RefCounted

class_name ScenarioCache

var source_path: String = ""
var summary: Dictionary = {}
var factions: Array = []
var characters: Array = []
var map_regions: Array = []
var armies: Array = []
var variables: Array = []
var events: Array = []
var factions_by_id: Dictionary = {}
var factions_by_name: Dictionary = {}
var characters_by_id: Dictionary = {}
var characters_by_name: Dictionary = {}
var regions_by_id: Dictionary = {}
var regions_by_name: Dictionary = {}
var armies_by_id: Dictionary = {}
var armies_by_name: Dictionary = {}

func load_from_scenario_result(result: Dictionary) -> Dictionary:
	if not result.get("ok", false):
		return {
			"ok": false,
			"error": str(result.get("error", "scenario load failed"))
		}

	source_path = str(result.get("path", ""))
	summary = _dict(result.get("summary", {}))
	if summary.is_empty():
		return {
			"ok": false,
			"error": "scenario summary is empty"
		}

	factions = _array(summary.get("faction_rows", []))
	characters = _array(summary.get("character_rows", []))
	armies = _array(summary.get("army_rows", []))
	variables = _array(summary.get("variable_rows", []))
	events = _array(summary.get("event_rows", []))
	map_regions = _array(_dict(summary.get("map_view", {})).get("regions", []))

	factions_by_id = _index_by(factions, "id")
	factions_by_name = _index_by(factions, "name")
	characters_by_id = _index_by(characters, "id")
	characters_by_name = _index_by(characters, "name")
	regions_by_id = _index_by(map_regions, "id")
	regions_by_name = _index_by(map_regions, "name")
	armies_by_id = _index_by(armies, "id")
	armies_by_name = _index_by(armies, "name")

	return {"ok": true}

func faction_by_id(id: String) -> Dictionary:
	return _dict(factions_by_id.get(id, {}))

func faction_by_name(name: String) -> Dictionary:
	return _dict(factions_by_name.get(name, {}))

func character_by_id(id: String) -> Dictionary:
	return _dict(characters_by_id.get(id, {}))

func character_by_name(name: String) -> Dictionary:
	return _dict(characters_by_name.get(name, {}))

func region_by_id(id: String) -> Dictionary:
	return _dict(regions_by_id.get(id, {}))

func region_by_name(name: String) -> Dictionary:
	return _dict(regions_by_name.get(name, {}))

func army_by_id(id: String) -> Dictionary:
	return _dict(armies_by_id.get(id, {}))

func army_by_name(name: String) -> Dictionary:
	return _dict(armies_by_name.get(name, {}))

func characters_for_faction(faction_name: String) -> Array:
	var rows: Array = []
	for raw in characters:
		var character: Dictionary = _dict(raw)
		if str(character.get("faction", "")) == faction_name:
			rows.append(character)
	return rows

func regions_for_owner(owner_name: String) -> Array:
	var rows: Array = []
	for raw in map_regions:
		var region: Dictionary = _dict(raw)
		if str(region.get("owner", "")) == owner_name:
			rows.append(region)
	return rows

func summary_counts_text() -> String:
	return "cache factions=%d characters=%d regions=%d armies=%d variables=%d events=%d" % [
		factions.size(),
		characters.size(),
		map_regions.size(),
		armies.size(),
		variables.size(),
		events.size()
	]

static func _index_by(rows: Array, key: String) -> Dictionary:
	var index: Dictionary = {}
	for raw in rows:
		var row: Dictionary = _dict(raw)
		var value: String = str(row.get(key, ""))
		if not value.is_empty():
			index[value] = row
	return index

static func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

static func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []
