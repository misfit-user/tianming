extends RefCounted

class_name ScenarioLoader

const SCENARIO_DIR := "res://../scenarios"
const SCENARIO_DIRS := [
	"res://../scenarios",
	"res://../../scenarios",
]
const WEB_ROOT := "res://../web"

static func load_official_summary() -> Dictionary:
	var scenario_dirs: PackedStringArray = _scenario_dir_candidates()
	var found: Dictionary = _find_official_tianqi_file_in_candidates(scenario_dirs)
	var scenario_dir: String = str(found.get("scenario_dir", ""))
	var file_path: String = str(found.get("path", ""))
	if file_path.is_empty():
		return {
			"ok": false,
			"error": "No official Tianqi scenario JSON found under %s" % _join_packed_strings(scenario_dirs, ", ")
		}

	var text: String = FileAccess.get_file_as_string(file_path)
	var err: Error = FileAccess.get_open_error()
	if err != OK:
		return {
			"ok": false,
			"error": "Failed to read scenario: %s (error %d)" % [file_path, err]
		}

	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return {
			"ok": false,
			"error": "Scenario JSON did not parse as an object: %s" % file_path
		}

	return {
		"ok": true,
		"path": file_path,
		"scenario_dir": scenario_dir,
		"summary": _build_summary(parsed)
	}

static func _scenario_dir_candidates() -> PackedStringArray:
	var candidates := PackedStringArray()
	for scenario_dir in SCENARIO_DIRS:
		var globalized: String = ProjectSettings.globalize_path(str(scenario_dir))
		if not candidates.has(globalized):
			candidates.append(globalized)
	return candidates

static func _find_official_tianqi_file_in_candidates(scenario_dirs: PackedStringArray) -> Dictionary:
	for scenario_dir in scenario_dirs:
		var file_path: String = _find_official_tianqi_file(scenario_dir)
		if not file_path.is_empty():
			return {
				"path": file_path,
				"scenario_dir": scenario_dir,
			}
	return {
		"path": "",
		"scenario_dir": "",
	}

static func _join_packed_strings(values: PackedStringArray, separator: String) -> String:
	var parts: Array[String] = []
	for value in values:
		parts.append(str(value))
	return separator.join(parts)

static func _find_official_tianqi_file(scenario_dir: String) -> String:
	var dir: DirAccess = DirAccess.open(scenario_dir)
	if dir == null:
		return ""

	var files: PackedStringArray = dir.get_files()
	files.sort()
	for file_name in files:
		if not file_name.ends_with(".json"):
			continue
		if file_name.contains("天启") and file_name.contains("官方"):
			return scenario_dir.path_join(file_name)
	return ""

static func _build_summary(data: Dictionary) -> Dictionary:
	var scenario_name: String = str(data.get("name", "未命名剧本"))
	var guoku: Dictionary = _dict(data.get("guoku", {}))
	var neitang: Dictionary = _dict(data.get("neitang", {}))
	var population: Dictionary = _dict(data.get("populationConfig", {}))
	var population_initial: Dictionary = _dict(population.get("initial", {}))
	var authority: Dictionary = _dict(data.get("authorityConfig", {}))
	var authority_initial: Dictionary = _dict(authority.get("initial", {}))
	var map_data: Dictionary = _dict(data.get("mapData", data.get("map", {})))
	var map_regions: Array = _array(map_data.get("regions", []))
	var variables: Array = _array(data.get("variables", []))
	var factions: Array = _array(data.get("factions", []))
	var characters: Array = _array(data.get("characters", data.get("chars", [])))
	var events: Array = _array(data.get("events", []))
	var rigid_history_events: Array = _array(data.get("rigidHistoryEvents", []))
	var rigid_triggers: Dictionary = _dict(data.get("rigidTriggers", {}))
	var relations: Array = _array(data.get("relations", []))
	var faction_relations: Array = _array(data.get("factionRelations", []))
	var military_data: Dictionary = _dict(data.get("military", {}))
	var army_source: Array = _array(military_data.get("initialTroops", []))
	if army_source.is_empty():
		army_source = _array(military_data.get("armies", []))
	var army_rows: Array = _build_army_rows(army_source)
	var faction_names: Dictionary = _faction_name_lookup(factions)
	var region_names: Dictionary = _region_name_lookup(map_regions)

	return {
		"name": scenario_name,
		"dynasty": str(data.get("dynasty", "")),
		"era": str(data.get("era", "")),
		"emperor": str(data.get("emperor", "")),
		"start_year": int(data.get("startYear", 0)),
		"start_month": int(data.get("startMonth", _infer_month_from_name(scenario_name))),
		"start_day": int(data.get("startDay", 1)),
		"characters": _array(data.get("characters", data.get("chars", []))).size(),
		"factions": _array(data.get("factions", [])).size(),
		"parties": _array(data.get("parties", [])).size(),
		"classes": _array(data.get("classes", [])).size(),
		"variables": variables.size(),
		"events": events.size() + rigid_history_events.size() + rigid_triggers.size(),
		"map_regions": map_regions.size(),
		"armies": army_rows.size(),
		"relations": relations.size(),
		"faction_relations": faction_relations.size(),
		"guoku_money": _number(guoku.get("initialMoney", 0)),
		"guoku_grain": _number(guoku.get("initialGrain", 0)),
		"guoku_income_money": _number(_dict(guoku.get("monthlyIncomeEstimate", {})).get("money", 0)),
		"guoku_income_grain": _number(_dict(guoku.get("monthlyIncomeEstimate", {})).get("grain", 0)),
		"guoku_expense_money": _number(_dict(guoku.get("monthlyExpenseEstimate", {})).get("money", 0)),
		"guoku_expense_grain": _number(_dict(guoku.get("monthlyExpenseEstimate", {})).get("grain", 0)),
		"neitang_money": _number(neitang.get("initialMoney", 0)),
		"neitang_income_money": _number(_dict(neitang.get("monthlyIncomeEstimate", {})).get("money", 0)),
		"neitang_expense_money": _number(_dict(neitang.get("monthlyExpenseEstimate", {})).get("money", 0)),
		"population_registered": _number(population_initial.get("nationalMouths", 0)),
		"population_hidden": _number(population_initial.get("hiddenPopulation", 0)),
		"huangquan": _number(authority_initial.get("huangquan", 0)),
		"huangwei": _number(authority_initial.get("huangwei", 0)),
		"minxin": _number(authority_initial.get("minxin", 0)),
		"faction_rows": _build_faction_rows(factions),
		"region_rows": _build_region_rows(map_regions, faction_names, region_names),
		"character_rows": _build_character_rows(characters),
		"relationship_rows": _build_relation_rows(relations, "character_relation"),
		"faction_relation_rows": _build_relation_rows(faction_relations, "faction_relation"),
		"army_rows": army_rows,
		"variable_rows": _build_variable_rows(variables),
		"event_rows": _build_event_rows(events, rigid_history_events, rigid_triggers),
		"map_view": _build_map_view(map_data, map_regions, faction_names, region_names)
	}

static func _faction_name_lookup(factions: Array) -> Dictionary:
	var lookup: Dictionary = {}
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		var id: String = str(faction.get("id", ""))
		var name: String = str(faction.get("name", ""))
		if not id.is_empty() and not name.is_empty():
			lookup[id] = name
	return lookup

static func _region_name_lookup(regions: Array) -> Dictionary:
	var lookup: Dictionary = {}
	for raw in regions:
		var region: Dictionary = _dict(raw)
		var id: String = str(region.get("id", ""))
		var name: String = str(region.get("name", ""))
		if not id.is_empty() and not name.is_empty():
			lookup[id] = name
	return lookup

static func _build_faction_rows(factions: Array) -> Array:
	var rows: Array = []
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		var main_resources: Array = _array(faction.get("mainResources", faction.get("resources", [])))
		var relations: Dictionary = _dict(faction.get("relations", {}))
		var cohesion_data: Dictionary = _dict(faction.get("cohesion", {}))
		var public_opinion_data: Dictionary = _dict(faction.get("publicOpinion", {}))
		rows.append({
			"id": str(faction.get("id", faction.get("sid", ""))),
			"name": str(faction.get("name", "")),
			"type": str(faction.get("type", "")),
			"leader": str(faction.get("leader", "")),
			"leader_title": str(faction.get("leaderTitle", "")),
			"strength": int(_number(faction.get("strength", 0))),
			"military_strength": _number(faction.get("militaryStrength", 0)),
			"army": fmt_big(_number(faction.get("militaryStrength", 0)), ""),
			"economy": int(_number(faction.get("economy", 0))),
			"capital": str(faction.get("capital", "")),
			"territory": str(faction.get("territory", "")),
			"attitude": str(faction.get("attitude", "")),
			"goal": str(faction.get("goal", "")),
			"cohesion": int(_dict_average(cohesion_data, _number(faction.get("cohesion", 0)))),
			"military_cohesion": int(_number(cohesion_data.get("military", _dict_average(cohesion_data, 0)))),
			"population": _number(faction.get("population", 0)),
			"tech_level": int(_number(faction.get("techLevel", 0))),
			"culture_level": int(_number(faction.get("cultureLevel", 0))),
			"public_opinion": int(_dict_average(public_opinion_data, _number(faction.get("publicOpinion", 0)))),
			"war_state": str(faction.get("warState", "")),
			"economic_policy": str(faction.get("economicPolicy", "")),
			"resources_text": _join_text(main_resources, "、"),
			"relations_text": _relations_text(relations),
			"description": str(faction.get("description", faction.get("desc", ""))),
			"strategy": str(faction.get("strategy", faction.get("longTermStrategy", "")))
		})
	return rows

static func _build_region_rows(regions: Array, faction_names: Dictionary, region_names: Dictionary) -> Array:
	var rows: Array = []
	for raw in regions:
		var region: Dictionary = _dict(raw)
		var owner_id: String = str(region.get("owner", region.get("controller", "")))
		var neighbor_names: Array = _neighbor_names(_array(region.get("neighbors", [])), region_names)
		rows.append({
			"name": str(region.get("name", "")),
			"owner": str(faction_names.get(owner_id, owner_id)),
			"terrain": str(region.get("terrain", "")),
			"prosperity": int(_number(region.get("prosperity", 0))),
			"neighbors": _join_text(neighbor_names, "、")
		})
	return rows

static func _build_character_rows(characters: Array) -> Array:
	var rows: Array = []
	for raw in characters:
		var character: Dictionary = _dict(raw)
		var official_title: String = str(character.get("officialTitle", ""))
		var display_title: String = str(character.get("title", official_title))
		var portrait: String = str(character.get("portrait", ""))
		rows.append({
			"id": str(character.get("id", character.get("sid", ""))),
			"name": str(character.get("name", "")),
			"title": display_title,
			"official_title": official_title,
			"age": int(_number(character.get("age", 0))),
			"gender": str(character.get("gender", "")),
			"faction": str(character.get("faction", "")),
			"party": str(character.get("party", "无党")),
			"social_class": str(character.get("class", "")),
			"location": str(character.get("location", "")),
			"loyalty": int(_number(character.get("loyalty", 0))),
			"ambition": int(_number(character.get("ambition", 0))),
			"intelligence": int(_number(character.get("intelligence", 0))),
			"administration": int(_number(character.get("administration", 0))),
			"valor": int(_number(character.get("valor", 0))),
			"military": int(_number(character.get("military", 0))),
			"management": int(_number(character.get("management", 0))),
			"diplomacy": int(_number(character.get("diplomacy", 0))),
			"charisma": int(_number(character.get("charisma", 0))),
			"benevolence": int(_number(character.get("benevolence", 0))),
			"integrity": int(_number(character.get("integrity", 0))),
			"traits_text": _join_text(_array(character.get("traits", [])), "、"),
			"personality": str(character.get("personality", "")),
			"bio": str(character.get("bio", "")),
			"portrait": portrait,
			"portrait_path": _portrait_path(portrait)
		})
	return rows

static func _build_army_rows(armies: Array) -> Array:
	var rows: Array = []
	for i in range(armies.size()):
		var army: Dictionary = _dict(armies[i])
		var id: String = str(army.get("id", ""))
		if id.is_empty():
			id = "army_%03d" % (i + 1)
		var soldiers: float = _number(army.get("soldiers", army.get("size", 0)))
		var control_value: float = _number(army.get("control", army.get("controlLevel", 0)))
		rows.append({
			"id": id,
			"name": str(army.get("name", "")),
			"army_type": str(army.get("armyType", army.get("type", ""))),
			"faction": str(army.get("faction", "")),
			"soldiers": soldiers,
			"soldiers_text": fmt_big(soldiers, "人"),
			"garrison": str(army.get("garrison", army.get("location", ""))),
			"location": str(army.get("location", army.get("garrison", ""))),
			"commander": str(army.get("commander", "")),
			"commander_title": str(army.get("commanderTitle", "")),
			"quality": str(army.get("quality", "")),
			"morale": int(_number(army.get("morale", 0))),
			"training": int(_number(army.get("training", 0))),
			"loyalty": int(_number(army.get("loyalty", 0))),
			"control": int(control_value),
			"control_level": int(_number(army.get("controlLevel", control_value))),
			"supply": int(_number(army.get("supply", 0))),
			"pay_arrears_months": int(_number(army.get("payArrearsMonths", 0))),
			"mutiny_risk": int(_number(army.get("mutinyRisk", 0))),
			"ethnicity": str(army.get("ethnicity", "")),
			"activity": str(army.get("activity", "")),
			"equipment_condition": str(army.get("equipmentCondition", "")),
			"composition_text": _composition_text(_array(army.get("composition", []))),
			"salary_text": _salary_text(_array(army.get("salary", []))),
			"equipment_text": _equipment_text(_array(army.get("equipment", []))),
			"description": str(army.get("description", army.get("desc", ""))),
			"sid": str(army.get("sid", ""))
		})
	return rows

static func _build_relation_rows(relations: Array, prefix: String) -> Array:
	var rows: Array = []
	for i in range(relations.size()):
		var relation: Dictionary = _dict(relations[i])
		var id: String = str(relation.get("id", ""))
		if id.is_empty():
			id = "%s_%d" % [prefix, i + 1]
		rows.append({
			"id": id,
			"from": str(relation.get("from", "")),
			"to": str(relation.get("to", "")),
			"type": str(relation.get("type", "")),
			"value": int(_number(relation.get("value", 0))),
			"desc": str(relation.get("desc", "")),
			"sid": str(relation.get("sid", ""))
		})
	return rows

static func _build_variable_rows(variables: Array) -> Array:
	var rows: Array = []
	for raw in variables:
		var variable: Dictionary = _dict(raw)
		var unit: String = str(variable.get("unit", ""))
		rows.append({
			"id": str(variable.get("id", variable.get("sid", ""))),
			"name": str(variable.get("name", "")),
			"raw_value": _number(variable.get("value", 0)),
			"value": "%s%s" % [str(variable.get("value", "")), unit],
			"min": _number(variable.get("min", 0)),
			"max": _number(variable.get("max", 0)),
			"unit": unit,
			"category": str(variable.get("cat", "")),
			"desc": str(variable.get("desc", ""))
		})
	return rows

static func _build_event_rows(events: Array, rigid_history_events: Array, rigid_triggers: Dictionary) -> Array:
	var rows: Array = []
	for raw in events:
		var event: Dictionary = _dict(raw)
		rows.append({
			"id": str(event.get("id", event.get("sid", event.get("name", "")))),
			"name": str(event.get("name", "")),
			"source": "events",
			"type": str(event.get("type", "")),
			"category": str(event.get("category", "")),
			"importance": str(event.get("importance", "")),
			"trigger": str(event.get("trigger", "")),
			"trigger_turn": int(_number(event.get("triggerTurn", 0))),
			"effect": str(event.get("effect", "")),
			"effect_data": _dict(event.get("effect", {})).duplicate(true),
			"choices": _choice_rows(_array(event.get("choices", []))),
			"description": str(event.get("description", event.get("narrative", ""))),
			"narrative": str(event.get("narrative", event.get("description", ""))),
			"triggered": bool(event.get("triggered", false))
		})
	for raw in rigid_history_events:
		var event: Dictionary = _dict(raw)
		rows.append({
			"id": str(event.get("id", event.get("name", ""))),
			"name": str(event.get("name", "")),
			"source": "rigid_history",
			"type": "rigid_history",
			"category": "rigid",
			"importance": "关键",
			"trigger": str(event.get("trigger", "")),
			"trigger_turn": int(_number(event.get("triggerTurn", 0))),
			"effect": str(event.get("effect", "")),
			"effect_data": _dict(event.get("effect", {})).duplicate(true),
			"choices": _choice_rows(_array(event.get("choices", []))),
			"description": str(event.get("description", event.get("narrative", ""))),
			"narrative": str(event.get("narrative", event.get("description", ""))),
			"triggered": bool(event.get("triggered", false))
		})
	var trigger_keys: Array = rigid_triggers.keys()
	trigger_keys.sort()
	for key in trigger_keys:
		var event: Dictionary = _dict(rigid_triggers[key])
		rows.append({
			"id": str(key),
			"name": str(event.get("name", key)),
			"source": "rigid_trigger",
			"type": str(event.get("type", "rigid_trigger")),
			"category": "rigid",
			"importance": "关键",
			"trigger": "turn <= %d" % int(_number(event.get("turn", 0))),
			"trigger_turn": int(_number(event.get("turn", 0))),
			"effect": _effect_text(event.get("effect", "")),
			"effect_data": _dict(event.get("effect", {})).duplicate(true),
			"choices": _choice_rows(_array(event.get("choices", []))),
			"description": str(event.get("description", event.get("narrative", ""))),
			"narrative": str(event.get("narrative", event.get("description", ""))),
			"triggered": false
		})
	return rows

static func _choice_rows(choices: Array) -> Array:
	var rows: Array = []
	for raw in choices:
		var choice: Dictionary = _dict(raw)
		rows.append({
			"text": str(choice.get("text", choice.get("label", ""))),
			"effect": _effect_text(choice.get("effect", "")),
			"effect_data": _dict(choice.get("effect", {})).duplicate(true)
		})
	return rows

static func _build_map_view(map_data: Dictionary, regions: Array, faction_names: Dictionary, region_names: Dictionary) -> Dictionary:
	var draw_regions: Array = []
	var min_x: float = INF
	var min_y: float = INF
	var max_x: float = -INF
	var max_y: float = -INF

	for raw in regions:
		var region: Dictionary = _dict(raw)
		var coords: Array = _array(region.get("coords", []))
		if coords.size() < 6:
			continue

		var clean_coords: Array = []
		for i in range(0, coords.size() - 1, 2):
			var x: float = _number(coords[i])
			var y: float = _number(coords[i + 1])
			clean_coords.append(x)
			clean_coords.append(y)
			min_x = minf(min_x, x)
			min_y = minf(min_y, y)
			max_x = maxf(max_x, x)
			max_y = maxf(max_y, y)

		var owner_id: String = str(region.get("owner", region.get("controller", "")))
		var controller_id: String = str(region.get("controller", owner_id))
		var prefectures: Array = _array(region.get("prefectures", []))
		draw_regions.append({
			"id": str(region.get("id", "")),
			"name": str(region.get("name", "")),
			"owner_id": owner_id,
			"owner": str(faction_names.get(owner_id, owner_id)),
			"controller_id": controller_id,
			"controller": str(faction_names.get(controller_id, controller_id)),
			"terrain": str(region.get("terrain", "")),
			"resources": _resource_names(region.get("resources", [])),
			"development": int(_number(region.get("development", 0))),
			"prosperity": int(_number(region.get("prosperity", 0))),
			"troops": int(_number(region.get("troops", 0))),
			"mood": int(_number(region.get("mood", 0))),
			"unrest": int(_number(region.get("unrest", 0))),
			"tax_pressure": int(_number(region.get("taxPressure", 0))),
			"army_pressure": int(_number(region.get("armyPressure", 0))),
			"neighbors": _neighbor_names(_array(region.get("neighbors", [])), region_names),
			"prefecture_count": int(_number(region.get("prefectureCount", prefectures.size()))),
			"prefectures": _prefecture_names(prefectures),
			"color": str(region.get("factionColor", region.get("color", ""))),
			"coords": clean_coords
		})

	if draw_regions.is_empty():
		min_x = 0.0
		min_y = 0.0
		max_x = maxf(1.0, _number(map_data.get("width", 1)))
		max_y = maxf(1.0, _number(map_data.get("height", 1)))

	return {
		"width": _number(map_data.get("width", max_x)),
		"height": _number(map_data.get("height", max_y)),
		"bounds": {
			"min_x": min_x,
			"min_y": min_y,
			"max_x": max_x,
			"max_y": max_y
		},
		"regions": draw_regions
	}

static func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

static func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

static func _neighbor_names(neighbors: Array, region_names: Dictionary) -> Array:
	var names: Array = []
	for raw_id in neighbors:
		var id: String = str(raw_id)
		names.append(str(region_names.get(id, id)))
	return names

static func _resource_names(value: Variant) -> Array:
	var names: Array = []
	for raw in _array(value):
		if typeof(raw) == TYPE_DICTIONARY:
			var resource: Dictionary = _dict(raw)
			names.append(str(resource.get("name", resource.get("id", ""))))
		else:
			names.append(str(raw))
	return names

static func _prefecture_names(prefectures: Array) -> Array:
	var names: Array = []
	for raw in prefectures:
		var prefecture: Dictionary = _dict(raw)
		var name: String = str(prefecture.get("name", ""))
		if not name.is_empty():
			names.append(name)
	return names

static func _join_text(values: Array, separator: String) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for raw in values:
		var text: String = str(raw)
		if not text.is_empty():
			parts.append(text)
	return separator.join(parts)

static func _composition_text(rows: Array) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for raw in rows:
		if typeof(raw) != TYPE_DICTIONARY:
			parts.append(str(raw))
			continue
		var item: Dictionary = _dict(raw)
		var label: String = str(item.get("type", item.get("name", "")))
		var count: float = _number(item.get("count", 0))
		if count > 0.0:
			parts.append("%s %s" % [label, fmt_big(count, "人")])
		else:
			parts.append(label)
	return "、".join(parts)

static func _salary_text(rows: Array) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for raw in rows:
		if typeof(raw) != TYPE_DICTIONARY:
			parts.append(str(raw))
			continue
		var item: Dictionary = _dict(raw)
		parts.append("%s %s%s" % [
			str(item.get("resource", "")),
			fmt_big(_number(item.get("amount", 0)), ""),
			str(item.get("unit", ""))
		])
	return "、".join(parts)

static func _equipment_text(rows: Array) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for raw in rows:
		if typeof(raw) != TYPE_DICTIONARY:
			parts.append(str(raw))
			continue
		var item: Dictionary = _dict(raw)
		var text: String = str(item.get("name", ""))
		var count: float = _number(item.get("count", 0))
		var condition: String = str(item.get("condition", ""))
		if count > 0.0:
			text = "%s %s" % [text, fmt_big(count, "")]
		if not condition.is_empty():
			text = "%s（%s）" % [text, condition]
		parts.append(text)
	return "、".join(parts)

static func _relations_text(relations: Dictionary) -> String:
	if relations.is_empty():
		return "无"
	var parts: PackedStringArray = PackedStringArray()
	var keys: Array = relations.keys()
	keys.sort()
	for key in keys:
		parts.append("%s %d" % [str(key), int(_number(relations[key]))])
	return "\n".join(parts)

static func _effect_text(value: Variant) -> String:
	if typeof(value) != TYPE_DICTIONARY:
		return str(value)
	var parts: PackedStringArray = PackedStringArray()
	var effect: Dictionary = _dict(value)
	var keys: Array = effect.keys()
	keys.sort()
	for key in keys:
		parts.append("%s %s" % [str(key), str(effect[key])])
	return "、".join(parts)

static func _dict_average(values: Dictionary, fallback: float) -> float:
	if values.is_empty():
		return fallback
	var total: float = 0.0
	var count: int = 0
	for key in values.keys():
		var value: Variant = values[key]
		if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
			total += float(value)
			count += 1
	if count == 0:
		return fallback
	return total / float(count)

static func _infer_month_from_name(scenario_name: String) -> int:
	var month_names: Array = [
		"正月",
		"二月",
		"三月",
		"四月",
		"五月",
		"六月",
		"七月",
		"八月",
		"九月",
		"十月",
		"十一月",
		"十二月"
	]
	for i in range(month_names.size()):
		if scenario_name.contains(str(month_names[i])):
			return i + 1
	return 1

static func _portrait_path(portrait: String) -> String:
	if portrait.is_empty():
		return ""
	if portrait.is_absolute_path():
		return portrait
	return ProjectSettings.globalize_path(WEB_ROOT.path_join(portrait))

static func _number(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	var parsed: float = str(value).to_float()
	return parsed if is_finite(parsed) else 0.0

static func fmt_big(value: float, suffix: String = "") -> String:
	var abs_value: float = absf(value)
	if abs_value >= 100000000.0:
		return "%.1f亿%s" % [value / 100000000.0, suffix]
	if abs_value >= 10000.0:
		return "%.1f万%s" % [value / 10000.0, suffix]
	return "%d%s" % [roundi(value), suffix]
