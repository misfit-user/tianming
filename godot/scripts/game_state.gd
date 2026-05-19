extends RefCounted

class_name GameState

const ScenarioCacheScript := preload("res://scripts/scenario_cache.gd")
const MonthlySimulatorScript := preload("res://scripts/monthly_simulator.gd")
const SAVE_FORMAT := "tianming-godot-save-v1"

signal state_changed

var scenario_path: String = ""
var summary: Dictionary = {}
var scenario_cache: RefCounted
var monthly_simulator: RefCounted
var last_turn_report: Dictionary = {}
var turn_reports: Array = []
var characters: Array = []
var factions: Array = []
var map_regions: Array = []
var armies: Array = []
var variables: Array = []
var variable_values: Dictionary = {}
var event_deck: Array = []
var character_relations: Array = []
var faction_relations: Array = []
var event_queue: Array = []
var resolved_events: Array = []
var triggered_event_ids: Dictionary = {}
var player_actions: Array = []
var action_history: Array = []
var statecraft_history: Array = []
var court_offices: Array = []
var office_assignments: Dictionary = {}
var appointment_history: Array = []
var edict_templates: Array = []
var issued_edicts: Array = []
var military_order_templates: Array = []
var issued_military_orders: Array = []
var army_command_history: Array = []
var army_action_history: Array = []
var army_redeployment_history: Array = []
var diplomacy_actions: Array = []
var diplomacy_history: Array = []
var faction_action_history: Array = []
var active_diplomacy_commitments: Array = []
var court_meeting_topics: Array = []
var court_meeting_history: Array = []
var pending_court_recommendations: Array = []
var enacted_court_recommendations: Array = []
var discarded_court_recommendations: Array = []
var communication_inbox: Array = []
var communication_archive: Array = []
var audience_history: Array = []
var character_action_history: Array = []
var region_governance_history: Array = []
var action_points_per_turn: int = 3
var action_points: int = 3
var turn: int = 1
var year: int = 0
var month: int = 1
var day: int = 1
var guoku_money: float = 0.0
var guoku_grain: float = 0.0
var neitang_money: float = 0.0
var population_registered: float = 0.0
var population_hidden: float = 0.0
var huangquan: float = 0.0
var huangwei: float = 0.0
var minxin: float = 0.0

func load_from_scenario_result(result: Dictionary) -> Dictionary:
	if not result.get("ok", false):
		return {
			"ok": false,
			"error": str(result.get("error", "scenario load failed"))
		}

	scenario_cache = ScenarioCacheScript.new()
	var cache_result: Dictionary = scenario_cache.load_from_scenario_result(result)
	if not cache_result.get("ok", false):
		return cache_result

	scenario_path = scenario_cache.source_path
	summary = scenario_cache.summary
	if summary.is_empty():
		return {
			"ok": false,
			"error": "scenario summary is empty"
		}

	turn = 1
	year = int(_number(summary.get("start_year", 0)))
	month = clampi(int(_number(summary.get("start_month", 1))), 1, 12)
	day = clampi(int(_number(summary.get("start_day", 1))), 1, 28)
	guoku_money = _number(summary.get("guoku_money", 0))
	guoku_grain = _number(summary.get("guoku_grain", 0))
	neitang_money = _number(summary.get("neitang_money", 0))
	population_registered = _number(summary.get("population_registered", 0))
	population_hidden = _number(summary.get("population_hidden", 0))
	huangquan = _number(summary.get("huangquan", 0))
	huangwei = _number(summary.get("huangwei", 0))
	minxin = _number(summary.get("minxin", 0))
	characters = _array(scenario_cache.characters).duplicate(true)
	factions = _array(scenario_cache.factions).duplicate(true)
	map_regions = _array(scenario_cache.map_regions).duplicate(true)
	armies = _array(scenario_cache.armies).duplicate(true)
	variables = _array(scenario_cache.variables).duplicate(true)
	variable_values = _build_variable_values(variables)
	event_deck = _array(scenario_cache.events).duplicate(true)
	character_relations = _array(summary.get("relationship_rows", [])).duplicate(true)
	faction_relations = _array(summary.get("faction_relation_rows", [])).duplicate(true)
	event_queue = []
	resolved_events = []
	triggered_event_ids = {}
	player_actions = _default_player_actions()
	action_history = []
	statecraft_history = []
	court_offices = _default_court_offices()
	office_assignments = _initial_office_assignments(characters, court_offices)
	appointment_history = []
	edict_templates = _default_edict_templates()
	issued_edicts = []
	military_order_templates = _default_military_order_templates()
	issued_military_orders = []
	army_command_history = []
	army_action_history = []
	army_redeployment_history = []
	diplomacy_actions = _default_diplomacy_actions()
	diplomacy_history = []
	faction_action_history = []
	active_diplomacy_commitments = []
	court_meeting_topics = _default_court_meeting_topics()
	court_meeting_history = []
	pending_court_recommendations = []
	enacted_court_recommendations = []
	discarded_court_recommendations = []
	communication_archive = []
	audience_history = []
	character_action_history = []
	region_governance_history = []
	action_points_per_turn = 3
	action_points = action_points_per_turn
	monthly_simulator = MonthlySimulatorScript.new()
	turn_reports = []
	last_turn_report = monthly_simulator.call("preview_month", self)
	communication_inbox = _initial_communications()

	return {"ok": true}

func create_save_snapshot() -> Dictionary:
	return {
		"format": SAVE_FORMAT,
		"scenario_path": scenario_path,
		"scenario_name": str(summary.get("name", "")),
		"state": {
			"turn": turn,
			"year": year,
			"month": month,
			"day": day,
			"action_points_per_turn": action_points_per_turn,
			"action_points": action_points,
			"guoku_money": guoku_money,
			"guoku_grain": guoku_grain,
			"neitang_money": neitang_money,
			"population_registered": population_registered,
			"population_hidden": population_hidden,
			"huangquan": huangquan,
			"huangwei": huangwei,
			"minxin": minxin,
			"characters": characters.duplicate(true),
			"factions": factions.duplicate(true),
			"map_regions": map_regions.duplicate(true),
			"armies": armies.duplicate(true),
			"variables": variables.duplicate(true),
			"variable_values": variable_values.duplicate(true),
			"event_deck": event_deck.duplicate(true),
			"character_relations": character_relations.duplicate(true),
			"faction_relations": faction_relations.duplicate(true),
			"event_queue": event_queue.duplicate(true),
			"resolved_events": resolved_events.duplicate(true),
			"triggered_event_ids": triggered_event_ids.duplicate(true),
			"player_actions": player_actions.duplicate(true),
			"action_history": action_history.duplicate(true),
			"statecraft_history": statecraft_history.duplicate(true),
			"court_offices": court_offices.duplicate(true),
			"office_assignments": office_assignments.duplicate(true),
			"appointment_history": appointment_history.duplicate(true),
			"edict_templates": edict_templates.duplicate(true),
			"issued_edicts": issued_edicts.duplicate(true),
			"military_order_templates": military_order_templates.duplicate(true),
			"issued_military_orders": issued_military_orders.duplicate(true),
			"army_command_history": army_command_history.duplicate(true),
			"army_action_history": army_action_history.duplicate(true),
			"army_redeployment_history": army_redeployment_history.duplicate(true),
			"diplomacy_actions": diplomacy_actions.duplicate(true),
			"diplomacy_history": diplomacy_history.duplicate(true),
			"faction_action_history": faction_action_history.duplicate(true),
			"active_diplomacy_commitments": active_diplomacy_commitments.duplicate(true),
			"court_meeting_topics": court_meeting_topics.duplicate(true),
			"court_meeting_history": court_meeting_history.duplicate(true),
			"pending_court_recommendations": pending_court_recommendations.duplicate(true),
			"enacted_court_recommendations": enacted_court_recommendations.duplicate(true),
			"discarded_court_recommendations": discarded_court_recommendations.duplicate(true),
			"communication_inbox": communication_inbox.duplicate(true),
			"communication_archive": communication_archive.duplicate(true),
			"audience_history": audience_history.duplicate(true),
			"character_action_history": character_action_history.duplicate(true),
			"region_governance_history": region_governance_history.duplicate(true),
			"last_turn_report": last_turn_report.duplicate(true),
			"turn_reports": turn_reports.duplicate(true)
		}
	}

func restore_save_snapshot(snapshot: Dictionary) -> Dictionary:
	if str(snapshot.get("format", "")) != SAVE_FORMAT:
		return {
			"ok": false,
			"error": "unsupported save format"
		}
	if scenario_cache == null or summary.is_empty():
		return {
			"ok": false,
			"error": "scenario must be loaded before restoring a save"
		}
	var save_scenario_name: String = str(snapshot.get("scenario_name", ""))
	var current_scenario_name: String = str(summary.get("name", ""))
	if not save_scenario_name.is_empty() and not current_scenario_name.is_empty() and save_scenario_name != current_scenario_name:
		return {
			"ok": false,
			"error": "save belongs to another scenario: %s" % save_scenario_name
		}
	var data: Dictionary = _dict(snapshot.get("state", {}))
	if data.is_empty():
		return {
			"ok": false,
			"error": "save state is empty"
		}

	turn = max(1, int(_number(data.get("turn", turn))))
	year = int(_number(data.get("year", year)))
	month = clampi(int(_number(data.get("month", month))), 1, 12)
	day = clampi(int(_number(data.get("day", day))), 1, 28)
	action_points_per_turn = max(1, int(_number(data.get("action_points_per_turn", action_points_per_turn))))
	action_points = clampi(int(_number(data.get("action_points", action_points))), 0, action_points_per_turn)
	guoku_money = _number(data.get("guoku_money", guoku_money))
	guoku_grain = _number(data.get("guoku_grain", guoku_grain))
	neitang_money = _number(data.get("neitang_money", neitang_money))
	population_registered = _number(data.get("population_registered", population_registered))
	population_hidden = _number(data.get("population_hidden", population_hidden))
	huangquan = _number(data.get("huangquan", huangquan))
	huangwei = _number(data.get("huangwei", huangwei))
	minxin = _number(data.get("minxin", minxin))

	characters = _array(data.get("characters", characters)).duplicate(true)
	factions = _array(data.get("factions", factions)).duplicate(true)
	map_regions = _array(data.get("map_regions", map_regions)).duplicate(true)
	armies = _array(data.get("armies", armies)).duplicate(true)
	variables = _array(data.get("variables", variables)).duplicate(true)
	variable_values = _dict(data.get("variable_values", variable_values)).duplicate(true)
	event_deck = _array(data.get("event_deck", event_deck)).duplicate(true)
	character_relations = _array(data.get("character_relations", character_relations)).duplicate(true)
	faction_relations = _array(data.get("faction_relations", faction_relations)).duplicate(true)
	event_queue = _array(data.get("event_queue", event_queue)).duplicate(true)
	resolved_events = _array(data.get("resolved_events", resolved_events)).duplicate(true)
	triggered_event_ids = _dict(data.get("triggered_event_ids", triggered_event_ids)).duplicate(true)
	player_actions = _array(data.get("player_actions", player_actions)).duplicate(true)
	action_history = _array(data.get("action_history", action_history)).duplicate(true)
	statecraft_history = _array(data.get("statecraft_history", statecraft_history)).duplicate(true)
	court_offices = _array(data.get("court_offices", court_offices)).duplicate(true)
	office_assignments = _dict(data.get("office_assignments", office_assignments)).duplicate(true)
	appointment_history = _array(data.get("appointment_history", appointment_history)).duplicate(true)
	edict_templates = _array(data.get("edict_templates", edict_templates)).duplicate(true)
	issued_edicts = _array(data.get("issued_edicts", issued_edicts)).duplicate(true)
	military_order_templates = _array(data.get("military_order_templates", military_order_templates)).duplicate(true)
	issued_military_orders = _array(data.get("issued_military_orders", issued_military_orders)).duplicate(true)
	army_command_history = _array(data.get("army_command_history", army_command_history)).duplicate(true)
	army_action_history = _array(data.get("army_action_history", army_action_history)).duplicate(true)
	army_redeployment_history = _array(data.get("army_redeployment_history", army_redeployment_history)).duplicate(true)
	diplomacy_actions = _array(data.get("diplomacy_actions", diplomacy_actions)).duplicate(true)
	diplomacy_history = _array(data.get("diplomacy_history", diplomacy_history)).duplicate(true)
	faction_action_history = _array(data.get("faction_action_history", faction_action_history)).duplicate(true)
	active_diplomacy_commitments = _array(data.get("active_diplomacy_commitments", active_diplomacy_commitments)).duplicate(true)
	court_meeting_topics = _array(data.get("court_meeting_topics", court_meeting_topics)).duplicate(true)
	court_meeting_history = _array(data.get("court_meeting_history", court_meeting_history)).duplicate(true)
	pending_court_recommendations = _array(data.get("pending_court_recommendations", pending_court_recommendations)).duplicate(true)
	enacted_court_recommendations = _array(data.get("enacted_court_recommendations", enacted_court_recommendations)).duplicate(true)
	discarded_court_recommendations = _array(data.get("discarded_court_recommendations", discarded_court_recommendations)).duplicate(true)
	communication_inbox = _array(data.get("communication_inbox", communication_inbox)).duplicate(true)
	communication_archive = _array(data.get("communication_archive", communication_archive)).duplicate(true)
	audience_history = _array(data.get("audience_history", audience_history)).duplicate(true)
	character_action_history = _array(data.get("character_action_history", character_action_history)).duplicate(true)
	region_governance_history = _array(data.get("region_governance_history", region_governance_history)).duplicate(true)
	last_turn_report = _dict(data.get("last_turn_report", last_turn_report)).duplicate(true)
	turn_reports = _array(data.get("turn_reports", turn_reports)).duplicate(true)
	monthly_simulator = MonthlySimulatorScript.new()
	emit_signal("state_changed")
	return {"ok": true}

func advance_month() -> Dictionary:
	if monthly_simulator == null:
		monthly_simulator = MonthlySimulatorScript.new()
	var report: Dictionary = monthly_simulator.call("settle_month", self)
	_create_faction_ai_counterplays(report)
	_tick_diplomacy_commitments()
	turn_reports.append(report)
	last_turn_report = report
	_generate_monthly_communications(report)
	turn += 1
	month += 1
	if month > 12:
		month = 1
		year += 1
	action_points = action_points_per_turn
	emit_signal("state_changed")
	return report

func _create_faction_ai_counterplays(report: Dictionary) -> void:
	for raw_action in _array(report.get("faction_ai_actions", [])):
		var action: Dictionary = _dict(raw_action)
		var kind: String = str(action.get("kind", ""))
		if kind == "diplomatic_retaliation":
			_create_diplomatic_retaliation_counterplay(action)
			continue
		if kind == "alliance_shift":
			_create_alliance_shift_counterplay(action)
			continue
		if kind != "raid":
			continue
		var action_id: String = str(action.get("id", ""))
		if action_id.is_empty() or _has_counterplay_for_action(action_id):
			continue
		var target_region: String = str(action.get("target_region", "辽东（明·关宁东江）"))
		pending_court_recommendations.append({
			"id": "counterplay-%d-%s" % [turn, action_id],
			"turn": turn,
			"year": year,
			"month": month,
			"name": "驰援%s" % target_region,
			"category": "军务",
			"cost": 1,
			"step": 1,
			"desc": "后金袭扰后立即补饷、调兵和修防，压低边地兵压。",
			"source_faction_action_id": action_id,
			"source_faction_action": action.duplicate(true),
			"effects": {
				"treasury_money": -120000,
				"辽东防线稳固度": 4,
				"huangwei": 1
			},
			"region_effects": {
				target_region: {
					"army_pressure": -8,
					"unrest": -3,
					"mood": 2
				}
		}
	})

func _create_alliance_shift_counterplay(action: Dictionary) -> void:
	var action_id: String = str(action.get("id", ""))
	if action_id.is_empty() or _has_counterplay_for_action(action_id):
		return
	var target_faction: String = str(action.get("target_faction", "察哈尔"))
	pending_court_recommendations.append({
		"id": "counterplay-%d-%s" % [turn, action_id],
		"turn": turn,
		"year": year,
		"month": month,
		"name": "争取%s" % target_faction,
		"category": "外交",
		"cost": 1,
		"step": 1,
		"desc": "%s有倒向后金之势，遣使赏赐、互市并申明盟约，争取其重新牵制后金。" % target_faction,
		"source_faction_action_id": action_id,
		"source_faction_action": action.duplicate(true),
		"effects": {
			"treasury_money": -100000,
			"huangwei": 1
		},
		"faction_effects": {
			target_faction: {
				"relation_to_player": 10,
				"hostility": -4,
				"cohesion": 5,
				"ming_support": 1
			}
		}
	})

func _create_diplomatic_retaliation_counterplay(action: Dictionary) -> void:
	var action_id: String = str(action.get("id", ""))
	if action_id.is_empty() or _has_counterplay_for_action(action_id):
		return
	pending_court_recommendations.append({
		"id": "counterplay-%d-%s" % [turn, action_id],
		"turn": turn,
		"year": year,
		"month": month,
		"name": "遣使修复后金信义",
		"category": "外交",
		"cost": 1,
		"step": 1,
		"desc": "后金借毁约旧怨施压，遣使申明边事、补赐礼物，以压低敌意和边境紧张。",
		"source_faction_action_id": action_id,
		"source_faction_action": action.duplicate(true),
		"effects": {
			"treasury_money": -60000,
			"huangwei": 1
		},
		"faction_effects": {
			"后金": {
				"relation_to_player": 5,
				"hostility": -4,
				"border_tension": -5
			}
		}
	})

func _has_counterplay_for_action(action_id: String) -> bool:
	for raw in pending_court_recommendations:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("source_faction_action_id", "")) == action_id:
			return true
	for raw in enacted_court_recommendations:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("source_faction_action_id", "")) == action_id:
			return true
	return false

func date_text() -> String:
	return "公元 %d 年 %d 月 · 第 %d 回合" % [year, month, turn]

func treasury_text() -> String:
	return "国库 %s / %s" % [
		fmt_big(guoku_money, "两"),
		fmt_big(guoku_grain, "石")
	]

func neitang_text() -> String:
	return "内帑 %s" % fmt_big(neitang_money, "两")

func authority_text() -> String:
	return "皇权 %d · 皇威 %d · 民心 %d" % [
		roundi(huangquan),
		roundi(huangwei),
		roundi(minxin)
	]

func population_text() -> String:
	return "在籍 %s / 隐匿 %s" % [
		fmt_big(population_registered, "口"),
		fmt_big(population_hidden, "口")
	]

func last_report_text() -> String:
	if monthly_simulator == null:
		return "月度结算尚未开始"
	return str(monthly_simulator.call("report_text", last_turn_report))

func gameplay_hub_snapshot(has_quick_save: bool = false) -> Dictionary:
	return {
		"date": date_text(),
		"treasury": treasury_text(),
		"neitang": neitang_text(),
		"authority": authority_text(),
		"population": population_text(),
		"action_points": action_points,
		"pending_events_count": event_queue.size(),
		"pending_recommendations_count": pending_court_recommendations.size(),
		"pending_communications_count": communication_items().size(),
		"urgent_alerts": gameplay_hub_alerts(),
		"last_report": last_report_text(),
		"history": gameplay_hub_history(),
		"has_quick_save": has_quick_save
	}

func gameplay_hub_alerts() -> Array:
	var alerts: Array = []
	for raw_event in event_queue:
		var event: Dictionary = _dict(raw_event)
		alerts.append("事件：%s" % str(event.get("name", "未命名事件")))
	for raw_recommendation in pending_court_recommendations:
		var recommendation: Dictionary = _dict(raw_recommendation)
		alerts.append("建议：%s" % str(recommendation.get("name", "未命名建议")))
	for raw_communication in communication_items():
		var communication: Dictionary = _dict(raw_communication)
		alerts.append("来文：%s" % str(communication.get("title", "奏疏来文")))

	var report: Dictionary = _dict(last_turn_report)
	for raw in _array(report.get("military_alerts", [])):
		alerts.append("军务：%s" % str(raw))
	for raw_uprising in _array(report.get("uprisings", [])):
		var uprising: Dictionary = _dict(raw_uprising)
		alerts.append("起义：%s 于 %s" % [
			str(uprising.get("name", "起义军")),
			str(uprising.get("region", "地方"))
		])
	for raw_action in _array(report.get("faction_ai_actions", [])):
		var action: Dictionary = _dict(raw_action)
		var kind: String = str(action.get("kind", ""))
		if kind == "chahar_counterpressure":
			alerts.append("边务：察哈尔牵制后金")
		elif kind == "mongol_pressure":
			alerts.append("边务：后金压迫察哈尔")
		elif kind == "raid":
			alerts.append("边务：后金袭扰%s" % str(action.get("target_region", "辽东")))
		elif kind == "pressure":
			alerts.append("边务：后金施压%s" % str(action.get("target_region", "辽东")))
	return alerts

func gameplay_hub_history() -> String:
	var names: PackedStringArray = PackedStringArray()
	_append_gameplay_hub_history(names, action_history)
	_append_gameplay_hub_history(names, statecraft_history)
	_append_gameplay_hub_history(names, issued_edicts)
	_append_gameplay_hub_history(names, issued_military_orders)
	_append_gameplay_hub_history(names, army_action_history)
	_append_gameplay_hub_history(names, army_command_history)
	_append_gameplay_hub_history(names, army_redeployment_history)
	_append_gameplay_hub_history(names, diplomacy_history)
	_append_gameplay_hub_history(names, faction_action_history)
	_append_gameplay_hub_history(names, appointment_history)
	_append_gameplay_hub_history(names, audience_history)
	_append_gameplay_hub_history(names, character_action_history)
	_append_gameplay_hub_history(names, region_governance_history)
	if names.is_empty():
		return "无"
	return "、".join(names)

func _append_gameplay_hub_history(target: PackedStringArray, rows: Array) -> void:
	for raw in rows:
		var record: Dictionary = _dict(raw)
		var record_name: String = str(record.get("name", ""))
		if not record_name.is_empty():
			target.append(record_name)

func communication_items() -> Array:
	var items: Array = communication_inbox.duplicate(true)
	items.sort_custom(Callable(self, "_communication_entry_before"))
	return items

func process_communication(communication_id: String, action: String = "archive") -> Dictionary:
	var index: int = _communication_index(communication_id)
	if index < 0:
		return {
			"ok": false,
			"error": "communication not in inbox: %s" % communication_id
		}
	var item: Dictionary = _dict(communication_inbox[index]).duplicate(true)
	communication_inbox.remove_at(index)
	item["processed_turn"] = turn
	item["processed_year"] = year
	item["processed_month"] = month
	item["processed_action"] = action
	var recommendation: Dictionary = {}
	if action == "recommend":
		recommendation = _communication_recommendation(item)
		pending_court_recommendations.append(recommendation)
		item["created_recommendation_id"] = str(recommendation.get("id", ""))
		item["status"] = "recommended"
	else:
		item["status"] = "archived"
	communication_archive.append(item)
	emit_signal("state_changed")
	return {
		"ok": true,
		"communication": item,
		"recommendation": recommendation
	}

func _initial_communications() -> Array:
	return [
		_communication_entry(
			"initial-liaodong-arrears",
			"memorial",
			"兵部",
			"辽饷积欠奏",
			"军务",
			"辽东与九边饷项连年积欠，边镇请先核拨现银，免军心摇动。",
			85,
			{"辽饷积欠": -20, "皇威": 1}
		),
		_communication_entry(
			"initial-censorate-corruption",
			"memorial",
			"都察院",
			"吏治风闻奏",
			"吏治",
			"御史言地方催科与衙门侵渔并见，宜遣官清核，稍振纲纪。",
			64,
			{"皇权": 1, "皇威": 1}
		),
		_communication_entry(
			"initial-liaodong-letter",
			"letter",
			"辽东经略",
			"辽左塘报",
			"边务",
			"辽左塘骑报称后金沿边窥伺，军士盼饷，城堡器械亦需修补。",
			78,
			{"辽东防线稳固度": 2, "皇威": 1}
		)
	]

func _generate_monthly_communications(report: Dictionary) -> void:
	var report_turn: int = int(_number(report.get("turn", turn)))
	if _number(report.get("guoku_money_shortfall", 0)) > 0.0:
		communication_inbox.append(_communication_entry(
			"turn-%d-fiscal-shortfall" % report_turn,
			"memorial",
			"户部",
			"国用告急奏",
			"财政",
			"户部言本月国用不敷，若不早筹财源，边饷与赈济将相互牵制。",
			82,
			{"帑廪": 120000, "皇权": 1},
			report
		))
	if _array(report.get("military_alerts", [])).size() > 0 or _number(report.get("liaodong_frontier_delta", 0)) < 0.0:
		communication_inbox.append(_communication_entry(
			"turn-%d-frontier-memorial" % report_turn,
			"memorial",
			"兵部",
			"边防急务奏",
			"军务",
			"兵部汇报边防告警，请择要议处军饷、器械与将领节制。",
			88,
			{"辽饷积欠": -15, "皇威": 1},
			report
		))
	if _array(report.get("events", [])).size() > 0:
		communication_inbox.append(_communication_entry(
			"turn-%d-event-memorial" % report_turn,
			"memorial",
			"通政司",
			"待议事件汇奏",
			"朝政",
			"本月到期奏报与异闻已入事件清册，请圣裁先后。",
			58,
			{"皇权": 1},
			report
		))
	if _array(report.get("faction_ai_actions", [])).size() > 0:
		communication_inbox.append(_communication_entry(
			"turn-%d-frontier-letter" % report_turn,
			"letter",
			"边臣塘报",
			"边外势力来文",
			"边务",
			"边臣送来外部势力动向，建议并入御前会议或外交清册统筹处置。",
			74,
			{"皇威": 1},
			report
		))

func _communication_entry(id_suffix: String, kind: String, sender: String, title: String, category: String, body: String, priority: int, recommendation_effects: Dictionary, report: Dictionary = {}) -> Dictionary:
	var entry_turn: int = int(_number(report.get("turn", turn)))
	var entry_year: int = int(_number(report.get("year", year)))
	var entry_month: int = int(_number(report.get("month", month)))
	return {
		"id": "communication-%s" % id_suffix,
		"kind": kind,
		"sender": sender,
		"title": title,
		"name": title,
		"category": category,
		"body": body,
		"priority": priority,
		"turn": entry_turn,
		"year": entry_year,
		"month": entry_month,
		"recommendation_effects": recommendation_effects.duplicate(true),
		"status": "pending"
	}

func _communication_recommendation(item: Dictionary) -> Dictionary:
	var communication_id: String = str(item.get("id", "communication"))
	return {
		"id": "recommend-%d-%s" % [turn, communication_id],
		"turn": turn,
		"year": year,
		"month": month,
		"name": "议处%s" % str(item.get("title", "奏疏来文")),
		"category": str(item.get("category", "朝政")),
		"cost": 1,
		"step": 1,
		"source_communication_id": communication_id,
		"source_communication_title": str(item.get("title", "")),
		"desc": str(item.get("body", "")),
		"effects": _dict(item.get("recommendation_effects", {"皇威": 1})).duplicate(true)
	}

func _communication_index(communication_id: String) -> int:
	for i in range(communication_inbox.size()):
		var item: Dictionary = _dict(communication_inbox[i])
		if str(item.get("id", "")) == communication_id:
			return i
	return -1

func _communication_entry_before(a: Dictionary, b: Dictionary) -> bool:
	var a_priority: int = int(_number(a.get("priority", 0)))
	var b_priority: int = int(_number(b.get("priority", 0)))
	if a_priority != b_priority:
		return a_priority > b_priority
	var a_turn: int = int(_number(a.get("turn", 0)))
	var b_turn: int = int(_number(b.get("turn", 0)))
	if a_turn != b_turn:
		return a_turn < b_turn
	return str(a.get("id", "")) < str(b.get("id", ""))

func audience_topics() -> Array:
	return _default_audience_topics()

func hold_audience(character_id: String, topic_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var character: Dictionary = character_by_id(character_id)
	if character.is_empty():
		return {
			"ok": false,
			"error": "unknown character: %s" % character_id
		}
	var topic: Dictionary = _audience_topic_by_id(topic_id)
	if topic.is_empty():
		return {
			"ok": false,
			"error": "unknown audience topic: %s" % topic_id
		}
	var cost: int = max(1, int(_number(topic.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var score: float = _audience_score(character, topic)
	var attitude: String = _audience_attitude(character, score)
	var response: String = _audience_response(character, topic, attitude, score)
	var suggestion: Dictionary = _audience_suggestion(character, topic, score)
	action_points -= cost
	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": "audience-%d-%s-%s" % [turn, character_id, topic_id],
		"character_id": character_id,
		"character_name": str(character.get("name", character_id)),
		"topic_id": topic_id,
		"topic": str(topic.get("name", topic_id)),
		"domain": str(topic.get("domain", "")),
		"cost": cost,
		"score": roundi(score),
		"attitude": attitude,
		"response": response,
		"suggestion": suggestion
	}
	audience_history.append(record)
	if not suggestion.is_empty():
		pending_court_recommendations.append(suggestion)
		record["created_recommendation_id"] = str(suggestion.get("id", ""))
		audience_history[audience_history.size() - 1] = record
	emit_signal("state_changed")
	return {
		"ok": true,
		"record": record,
		"character": character,
		"topic": topic,
		"recommendation": suggestion
	}

func _audience_topic_by_id(topic_id: String) -> Dictionary:
	for raw in _default_audience_topics():
		var topic: Dictionary = _dict(raw)
		if str(topic.get("id", "")) == topic_id:
			return topic
	return {}

func _audience_score(character: Dictionary, topic: Dictionary) -> float:
	var ability: String = str(topic.get("ability", "intelligence"))
	var ability_score: float = _number(character.get(ability, character.get("intelligence", 50)))
	var loyalty_score: float = _number(character.get("loyalty", 50))
	var integrity_score: float = _number(character.get("integrity", 50))
	var ambition_penalty: float = maxf(0.0, _number(character.get("ambition", 50)) - 70.0) * 0.15
	return clampf(ability_score * 0.45 + loyalty_score * 0.30 + integrity_score * 0.20 - ambition_penalty + 5.0, 0.0, 100.0)

func _audience_attitude(character: Dictionary, score: float) -> String:
	if score >= 75.0:
		return "切直"
	if score >= 58.0:
		return "谨慎"
	if _number(character.get("loyalty", 50)) < 40.0:
		return "敷衍"
	return "保留"

func _audience_response(character: Dictionary, topic: Dictionary, attitude: String, _score: float) -> String:
	var name: String = str(character.get("name", "臣"))
	var topic_name: String = str(topic.get("name", "政务"))
	var domain: String = str(topic.get("domain", "朝政"))
	match attitude:
		"切直":
			return "%s对%s陈说甚详，直指%s症结，并愿领衔推动后续议处。" % [name, topic_name, domain]
		"谨慎":
			return "%s对%s多有顾虑，但仍提出可行条陈，请先小范围试行。" % [name, topic_name]
		"敷衍":
			return "%s言辞游移，对%s避重就轻，只愿依例具覆。" % [name, topic_name]
	return "%s对%s态度保留，建议再询相关官员互证。" % [name, topic_name]

func _audience_suggestion(character: Dictionary, topic: Dictionary, score: float) -> Dictionary:
	if score < 58.0:
		return {}
	var effects: Dictionary = _dict(topic.get("effects", {})).duplicate(true)
	if effects.is_empty():
		effects = {"皇权": 1}
	return {
		"id": "audience-rec-%d-%s-%s" % [turn, str(character.get("id", "character")), str(topic.get("id", "topic"))],
		"turn": turn,
		"year": year,
		"month": month,
		"name": "采纳%s问对条陈" % str(character.get("name", "臣工")),
		"category": str(topic.get("domain", "朝政")),
		"cost": 1,
		"step": 1,
		"source_audience_character_id": str(character.get("id", "")),
		"source_audience_character": str(character.get("name", "")),
		"source_audience_topic_id": str(topic.get("id", "")),
		"desc": "由问对《%s》转入议事清册。" % str(topic.get("name", "政务")),
		"effects": effects
	}

func chronicle_entries() -> Array:
	var entries: Array = []
	var order: int = 0
	for raw_report in turn_reports:
		var report: Dictionary = _dict(raw_report)
		if report.is_empty():
			continue
		order += 1
		entries.append({
			"kind": "monthly_report",
			"turn": int(_number(report.get("turn", order))),
			"year": int(_number(report.get("year", year))),
			"month": int(_number(report.get("month", month))),
			"order": order * 10,
			"title": "第%d回合月报" % int(_number(report.get("turn", order))),
			"summary": _chronicle_report_summary(report),
			"details": _chronicle_report_details(report)
		})
	order = _append_chronicle_history(entries, action_history, "player_action", "廷务行动", order)
	order = _append_chronicle_history(entries, statecraft_history, "statecraft", "国政态势", order)
	order = _append_chronicle_history(entries, appointment_history, "appointment", "官员任免", order)
	order = _append_chronicle_history(entries, issued_edicts, "edict", "诏令颁行", order)
	order = _append_chronicle_history(entries, issued_military_orders, "military_order", "军令颁行", order)
	order = _append_chronicle_history(entries, army_command_history, "army_command", "军队统帅", order)
	order = _append_chronicle_history(entries, army_action_history, "army_action", "军队处置", order)
	order = _append_chronicle_history(entries, army_redeployment_history, "army_redeployment", "军队调防", order)
	order = _append_chronicle_history(entries, diplomacy_history, "diplomacy", "鸿胪外务", order)
	order = _append_chronicle_history(entries, faction_action_history, "faction_action", "势力应对", order)
	order = _append_chronicle_history(entries, court_meeting_history, "court_meeting", "御前会议", order)
	order = _append_chronicle_history(entries, enacted_court_recommendations, "court_recommendation", "议事采纳", order)
	order = _append_chronicle_history(entries, communication_archive, "communication", "奏疏来文", order)
	order = _append_chronicle_history(entries, audience_history, "audience", "君臣问对", order)
	order = _append_chronicle_history(entries, character_action_history, "character_action", "人物处置", order)
	order = _append_chronicle_history(entries, region_governance_history, "region_governance", "地方治理", order)
	order = _append_chronicle_history(entries, resolved_events, "resolved_event", "事件处置", order)
	entries.sort_custom(Callable(self, "_chronicle_entry_before"))
	return entries

func _chronicle_report_summary(report: Dictionary) -> String:
	return "国库银 %s，国库粮 %s，内帑 %s，皇权 %s，皇威 %s，民心 %s" % [
		_signed_big(_number(report.get("guoku_money_delta", 0)), "两"),
		_signed_big(_number(report.get("guoku_grain_delta", 0)), "石"),
		_signed_big(_number(report.get("neitang_money_delta", 0)), "两"),
		_signed_big(_number(report.get("huangquan_delta", 0)), ""),
		_signed_big(_number(report.get("huangwei_delta", 0)), ""),
		_signed_big(_number(report.get("minxin_delta", 0)), "")
	]

func _chronicle_report_details(report: Dictionary) -> String:
	var lines: PackedStringArray = PackedStringArray()
	lines.append("辽饷 %s，九边欠饷 %s，辽东防线 %s" % [
		_signed_big(_number(report.get("liao_arrears_delta", 0)), "万两"),
		_signed_big(_number(report.get("jiubian_arrears_delta", 0)), "万两"),
		_signed_big(_number(report.get("liaodong_frontier_delta", 0)), "")
	])
	lines.append("在籍 %s，隐匿 %s，流民 %s" % [
		_signed_big(_number(report.get("population_registered_delta", 0)), "口"),
		_signed_big(_number(report.get("population_hidden_delta", 0)), "口"),
		_signed_big(_number(report.get("refugee_delta", 0)), "口")
	])
	var events: Array = _array(report.get("events", []))
	var faction_ai_actions: Array = _array(report.get("faction_ai_actions", []))
	var uprisings: Array = _array(report.get("uprisings", []))
	var alerts: Array = _array(report.get("military_alerts", []))
	lines.append("事件 %d，势力动向 %d，起义 %d，军务告警 %d" % [
		events.size(),
		faction_ai_actions.size(),
		uprisings.size(),
		alerts.size()
	])
	for raw_event in events:
		var event: Dictionary = _dict(raw_event)
		lines.append("事件待议：%s" % _chronicle_named_subject(event, "未命名事件"))
	for raw_action in faction_ai_actions:
		lines.append(_chronicle_faction_ai_action_text(_dict(raw_action)))
	for raw_uprising in uprisings:
		var uprising: Dictionary = _dict(raw_uprising)
		var uprising_name: String = str(uprising.get("name", uprising.get("faction", "起义军")))
		var uprising_reason: String = str(uprising.get("reason", "")).strip_edges()
		var reason_text: String = "。%s" % uprising_reason if not uprising_reason.is_empty() else ""
		lines.append("起义爆发：%s 于 %s 聚众 %s%s" % [
			uprising_name,
			str(uprising.get("region", "地方")),
			_signed_big(_number(uprising.get("army", 0)), "人"),
			reason_text
		])
	for raw_alert in alerts:
		lines.append("军务告警：%s" % str(raw_alert))
	return "\n".join(lines)

func _chronicle_named_subject(row: Dictionary, fallback: String) -> String:
	var title: String = str(row.get("title", "")).strip_edges()
	var name: String = str(row.get("name", row.get("id", ""))).strip_edges()
	if title.is_empty() and name.is_empty():
		return fallback
	if title.is_empty():
		return name
	if name.is_empty() or name == title:
		return title
	return "%s（%s）" % [title, name]

func _chronicle_faction_ai_action_text(action: Dictionary) -> String:
	var faction: String = str(action.get("faction", "外部势力"))
	var reason: String = str(action.get("reason", "")).strip_edges()
	var reason_text: String = "。%s" % reason if not reason.is_empty() else ""
	match str(action.get("kind", "")):
		"chahar_counterpressure":
			return "势力牵制：%s 牵制 %s，边境紧张 %s%s" % [
				faction,
				str(action.get("target_faction", "目标势力")),
				_signed_big(_number(action.get("border_tension_delta", 0)), ""),
				reason_text
			]
		"diplomatic_retaliation":
			return "毁约报复：%s 压迫 %s，边境紧张 %s%s" % [
				faction,
				str(action.get("target_region", action.get("target_faction", "边地"))),
				_signed_big(_number(action.get("border_tension_delta", 0)), ""),
				reason_text
			]
		"mongol_pressure":
			return "蒙古边务：%s 压迫 %s（%s），凝聚 %s，军压 %s%s" % [
				faction,
				str(action.get("target_faction", "目标势力")),
				str(action.get("target_region", "边地")),
				_signed_big(_number(action.get("cohesion_delta", 0)), ""),
				_signed_big(_number(action.get("army_pressure_delta", 0)), ""),
				reason_text
			]
		"alliance_shift":
			return "阵营转向：%s 倾向 %s，对明关系 %s，敌意 %s%s" % [
				faction,
				str(action.get("leaning_to", action.get("target_faction", "未知势力"))),
				_signed_big(_number(action.get("relation_delta", 0)), ""),
				_signed_big(_number(action.get("hostility_delta", 0)), ""),
				reason_text
			]
		"raid":
			return "边地袭扰：%s 袭扰 %s，国库银 %s，国库粮 %s，防线 %s%s" % [
				faction,
				str(action.get("target_region", "边地")),
				_signed_big(_number(action.get("treasury_money_delta", 0)), ""),
				_signed_big(_number(action.get("treasury_grain_delta", 0)), ""),
				_signed_big(_number(action.get("frontier_delta", 0)), ""),
				reason_text
			]
		_:
			return "势力施压：%s 压迫 %s，防线 %s%s" % [
				faction,
				str(action.get("target_region", action.get("target_faction", "边地"))),
				_signed_big(_number(action.get("frontier_delta", action.get("border_tension_delta", 0))), ""),
				reason_text
			]

func _append_chronicle_history(entries: Array, rows: Array, kind: String, label: String, order_seed: int) -> int:
	var order: int = order_seed
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if row.is_empty():
			continue
		order += 1
		var entry_name: String = str(row.get("name", row.get("title", row.get("id", label))))
		entries.append({
			"kind": kind,
			"turn": int(_number(row.get("turn", 0))),
			"year": int(_number(row.get("year", year))),
			"month": int(_number(row.get("month", month))),
			"order": order * 10 + _chronicle_kind_order(kind),
			"title": "%s：%s" % [label, entry_name],
			"summary": _chronicle_history_summary(row),
			"details": _chronicle_history_details(row)
		})
	return order

func _chronicle_history_summary(row: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	if row.has("cost"):
		parts.append("耗行动点 %d" % int(_number(row.get("cost", 0))))
	if row.has("outcome"):
		parts.append("结果 %s" % str(row.get("outcome", "")))
	if row.has("target_region"):
		parts.append("地块 %s" % str(row.get("target_region", "")))
	if row.has("target_faction"):
		parts.append("势力 %s" % str(row.get("target_faction", "")))
	if parts.is_empty():
		return "已入实录"
	return "，".join(parts)

func _chronicle_history_details(row: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	var description: String = str(row.get("description", row.get("desc", ""))).strip_edges()
	if not description.is_empty():
		parts.append(description)
	_append_chronicle_effect_group(parts, "朝廷", _dict(row.get("applied", {})), "national")
	_append_chronicle_effect_group(parts, "地块", _dict(row.get("region_applied", {})), "region")
	_append_chronicle_effect_group(parts, "势力", _dict(row.get("faction_applied", {})), "faction")
	_append_chronicle_effect_group(parts, "军队", _dict(row.get("army_applied", {})), "army")
	_append_chronicle_effect_group(parts, "国政", _dict(row.get("variable_applied", {})), "variable")
	_append_chronicle_appointment_detail(parts, row)
	_append_chronicle_region_control_detail(parts, row)
	if parts.is_empty():
		return "已入实录"
	return "\n".join(parts)

func _append_chronicle_effect_group(parts: PackedStringArray, group_label: String, values: Dictionary, label_type: String) -> void:
	if values.is_empty():
		return
	var keys: Array = values.keys()
	keys.sort()
	var effects: PackedStringArray = PackedStringArray()
	for raw_key in keys:
		var key: String = str(raw_key)
		effects.append("%s %s" % [
			_chronicle_effect_label(key, label_type),
			_signed_big(_number(values.get(raw_key, 0)), "")
		])
	if not effects.is_empty():
		parts.append("%s：%s" % [group_label, "，".join(effects)])

func _append_chronicle_appointment_detail(parts: PackedStringArray, row: Dictionary) -> void:
	var office: String = str(row.get("office", "")).strip_edges()
	var character: String = str(row.get("character", "")).strip_edges()
	if not office.is_empty() or not character.is_empty():
		parts.append("任命：%s%s%s" % [
			character if not character.is_empty() else "未名官员",
			" 出任 " if not office.is_empty() else "",
			office
		])
	var old_holder: String = str(row.get("old_holder", "")).strip_edges()
	var old_title: String = str(row.get("old_title", "")).strip_edges()
	if not old_holder.is_empty():
		var old_text: String = old_holder
		if not old_title.is_empty():
			old_text = "%s（原%s）" % [old_holder, old_title]
		parts.append("前任：%s" % old_text)
	if row.has("loyalty_delta"):
		parts.append("忠诚：%s" % _signed_big(_number(row.get("loyalty_delta", 0)), ""))

func _append_chronicle_region_control_detail(parts: PackedStringArray, row: Dictionary) -> void:
	var control: Dictionary = _dict(row.get("region_control", {}))
	if control.is_empty():
		return
	var region: String = str(control.get("region", row.get("target_region", ""))).strip_edges()
	var before: String = str(control.get("before_controller", "")).strip_edges()
	var after: String = str(control.get("after_controller", "")).strip_edges()
	if region.is_empty() and before.is_empty() and after.is_empty():
		return
	parts.append("归属：%s %s → %s" % [
		region if not region.is_empty() else "地块",
		before if not before.is_empty() else "未知",
		after if not after.is_empty() else "未知"
	])

func _chronicle_effect_label(key: String, label_type: String) -> String:
	match label_type:
		"region":
			return _region_field_label(key)
		"faction":
			return _faction_field_label(key)
		"army":
			return _army_field_label(key)
		"variable":
			return key
	match key:
		"treasury_money", "帑廪":
			return "国库银"
		"treasury_grain":
			return "国库粮"
		"inner_treasury_money":
			return "内帑"
		"huangquan", "imperial_authority", "皇权":
			return "皇权"
		"huangwei", "imperial_prestige", "皇威":
			return "皇威"
		"minxin", "public_morale", "民心":
			return "民心"
	return key

func _army_field_label(key: String) -> String:
	match key:
		"morale":
			return "士气"
		"training":
			return "操练"
		"loyalty":
			return "军心"
		"mutiny_risk":
			return "哗变风险"
		"supply":
			return "补给"
		"control", "control_level":
			return "控制"
		"pay_arrears_months":
			return "欠饷月数"
		"troops":
			return "兵力"
	return key

func _chronicle_kind_order(kind: String) -> int:
	match kind:
		"monthly_report":
			return 0
		"player_action":
			return 1
		"statecraft":
			return 2
		"court_meeting":
			return 3
		"court_recommendation":
			return 4
		"faction_action":
			return 5
		"communication":
			return 6
		"audience":
			return 7
		"character_action":
			return 8
		"region_governance":
			return 9
		"edict":
			return 10
		"military_order":
			return 11
		"diplomacy":
			return 12
		"appointment":
			return 13
		"resolved_event":
			return 14
	return 15

func _chronicle_entry_before(a: Dictionary, b: Dictionary) -> bool:
	var a_turn: int = int(_number(a.get("turn", 0)))
	var b_turn: int = int(_number(b.get("turn", 0)))
	if a_turn != b_turn:
		return a_turn < b_turn
	var a_year: int = int(_number(a.get("year", 0)))
	var b_year: int = int(_number(b.get("year", 0)))
	if a_year != b_year:
		return a_year < b_year
	var a_month: int = int(_number(a.get("month", 0)))
	var b_month: int = int(_number(b.get("month", 0)))
	if a_month != b_month:
		return a_month < b_month
	return int(_number(a.get("order", 0))) < int(_number(b.get("order", 0)))

func map_view_data() -> Dictionary:
	var data: Dictionary = _dict(summary.get("map_view", {})).duplicate(true)
	data["regions"] = map_regions
	return data

func relationship_rows() -> Dictionary:
	return {
		"characters": character_relations.duplicate(true),
		"factions": faction_relations.duplicate(true)
	}

func region_by_id(id: String) -> Dictionary:
	var index: int = _region_index_by_id(id)
	if index < 0:
		return {}
	return _dict(map_regions[index])

func variable_value(name: String) -> float:
	return _number(variable_values.get(name, 0))

func set_variable_value(name: String, value: float) -> void:
	variable_values[name] = value
	for i in range(variables.size()):
		var row: Dictionary = _dict(variables[i])
		if str(row.get("name", "")) != name:
			continue
		row["raw_value"] = value
		row["value"] = "%s%s" % [fmt_big(value, ""), str(row.get("unit", ""))]
		variables[i] = row
		return

func variable_rows() -> Array:
	var rows: Array = []
	for raw in variables:
		var row: Dictionary = _dict(raw).duplicate(true)
		var name: String = str(row.get("name", ""))
		if name.is_empty():
			continue
		var value: float = variable_value(name)
		row["raw_value"] = value
		row["value"] = "%s%s" % [fmt_big(value, ""), str(row.get("unit", ""))]
		row["status"] = _variable_status_text(row, value)
		rows.append(row)
	return rows

func statecraft_actions() -> Array:
	return _default_statecraft_actions()

func perform_statecraft_action(variable_name: String, action_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var action: Dictionary = _statecraft_action_by_id(action_id)
	if action.is_empty():
		return {
			"ok": false,
			"error": "unknown statecraft action: %s" % action_id
		}
	var target_variable: String = str(action.get("target_variable", variable_name))
	if target_variable.is_empty():
		target_variable = variable_name
	if target_variable.is_empty() or not variable_values.has(target_variable):
		return {
			"ok": false,
			"error": "unknown target variable: %s" % target_variable
		}
	if not variable_name.is_empty() and variable_name != target_variable:
		return {
			"ok": false,
			"error": "%s does not target %s" % [str(action.get("name", action_id)), variable_name]
		}
	var cost: int = maxi(1, int(_number(action.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var before_value: float = variable_value(target_variable)
	var applied: Dictionary = _apply_effects(_dict(action.get("effects", {})))
	var variable_applied: Dictionary = _apply_variable_effects(_dict(action.get("variable_effects", {})))
	var after_value: float = variable_value(target_variable)
	action_points -= cost
	var record: Dictionary = {
		"id": "statecraft-%d-%s-%s" % [turn, target_variable, action_id],
		"name": "%s：%s" % [target_variable, str(action.get("name", action_id))],
		"turn": turn,
		"year": year,
		"month": month,
		"target_variable": target_variable,
		"target_before": before_value,
		"target_after": after_value,
		"action_id": action_id,
		"action": str(action.get("name", action_id)),
		"category": str(action.get("category", "")),
		"cost": cost,
		"outcome": _statecraft_outcome(target_variable, before_value, after_value, action),
		"description": _statecraft_description(target_variable, before_value, after_value, action, variable_applied),
		"applied": applied,
		"variable_applied": variable_applied
	}
	statecraft_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"action": action,
		"record": record,
		"applied": applied,
		"variable_applied": variable_applied
	}

func faction_by_id(id: String) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("id", "")) == id:
			return _faction_with_relationship_summary(faction)
	return {}

func faction_by_name(name: String) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("name", "")) == name:
			return _faction_with_relationship_summary(faction)
	return {}

func _faction_with_relationship_summary(faction: Dictionary) -> Dictionary:
	var result: Dictionary = faction.duplicate(true)
	var top_level_text: String = _faction_top_level_relationship_text(result)
	if top_level_text.is_empty():
		return result
	var existing: String = str(result.get("relations_text", "")).strip_edges()
	if existing.is_empty() or existing == "无":
		result["relations_text"] = top_level_text
	else:
		result["relations_text"] = "%s\n%s" % [existing, top_level_text]
	return result

func _faction_top_level_relationship_text(faction: Dictionary) -> String:
	var faction_id: String = str(faction.get("id", ""))
	var faction_name: String = str(faction.get("name", ""))
	var lines: PackedStringArray = PackedStringArray()
	for raw in faction_relations:
		var relation: Dictionary = _dict(raw)
		var from_endpoint: String = str(relation.get("from", ""))
		var to_endpoint: String = str(relation.get("to", ""))
		var other_endpoint: String = ""
		if _relationship_endpoint_matches(from_endpoint, faction_id, faction_name):
			other_endpoint = to_endpoint
		elif _relationship_endpoint_matches(to_endpoint, faction_id, faction_name):
			other_endpoint = from_endpoint
		if other_endpoint.is_empty():
			continue
		var relation_type: String = str(relation.get("type", ""))
		var value_text: String = str(relation.get("value", ""))
		var desc: String = str(relation.get("desc", ""))
		var line: String = "%s" % other_endpoint
		if not relation_type.is_empty():
			line += " %s" % relation_type
		if not value_text.is_empty():
			line += " %s" % value_text
		if not desc.is_empty():
			line += "：%s" % desc
		lines.append(line)
	if lines.is_empty():
		return ""
	return "剧本关系：\n%s" % "\n".join(lines)

func faction_actions() -> Array:
	return _default_faction_actions()

func perform_faction_action(faction_id: String, action_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var target_index: int = _faction_index_by_id(faction_id)
	if target_index < 0:
		return {
			"ok": false,
			"error": "unknown target faction: %s" % faction_id
		}
	var action: Dictionary = _faction_action_by_id(action_id)
	if action.is_empty():
		return {
			"ok": false,
			"error": "unknown faction action: %s" % action_id
		}
	var cost: int = maxi(1, int(_number(action.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
	}

	var target_before: Dictionary = _dict(factions[target_index]).duplicate(true)
	var region_transfer: Dictionary = _apply_faction_region_transfer(target_index, action)
	if region_transfer.has("ok") and not bool(region_transfer.get("ok", false)):
		return {
			"ok": false,
			"error": str(region_transfer.get("error", "region transfer failed"))
		}
	var applied: Dictionary = _apply_effects(_dict(action.get("effects", {})))
	var faction_applied: Dictionary = _apply_faction_effects(target_index, _dict(action.get("faction_effects", {})))
	var target_after: Dictionary = _dict(factions[target_index]).duplicate(true)
	action_points -= cost
	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": "faction-action-%d-%s-%s" % [turn, faction_id, action_id],
		"name": "%s：%s" % [str(target_after.get("name", faction_id)), str(action.get("name", action_id))],
		"category": str(action.get("category", "")),
		"cost": cost,
		"target_faction_id": faction_id,
		"target_faction": str(target_after.get("name", "")),
		"action_id": action_id,
		"action": str(action.get("name", action_id)),
		"outcome": _faction_action_outcome(target_before, target_after, action, region_transfer),
		"description": _faction_action_description(target_before, target_after, action, region_transfer),
		"applied": applied,
		"faction_applied": faction_applied,
		"region_transfer": region_transfer
	}
	faction_action_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"action": action,
		"record": record,
		"target_faction": target_after,
		"applied": applied,
		"faction_applied": faction_applied,
		"region_transfer": region_transfer
	}

func character_by_id(id: String) -> Dictionary:
	for raw in characters:
		var character: Dictionary = _dict(raw)
		if str(character.get("id", "")) == id:
			return character
	return {}

func character_by_name(name: String) -> Dictionary:
	for raw in characters:
		var character: Dictionary = _dict(raw)
		if str(character.get("name", "")) == name:
			return character
	return {}

func character_actions() -> Array:
	return _default_character_actions()

func perform_character_action(character_id: String, action_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points left"
		}
	var character_index: int = _character_index_by_id(character_id)
	if character_index < 0:
		return {
			"ok": false,
			"error": "unknown character: %s" % character_id
		}
	var action: Dictionary = _character_action_by_id(action_id)
	if action.is_empty():
		return {
			"ok": false,
			"error": "unknown character action: %s" % action_id
		}
	var cost: int = maxi(1, int(_number(action.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}
	var inner_cost: float = maxf(0.0, _number(action.get("neitang_money_cost", 0)))
	if neitang_money < inner_cost:
		return {
			"ok": false,
			"error": "not enough inner treasury money"
		}

	var character: Dictionary = _dict(characters[character_index]).duplicate(true)
	var before: Dictionary = character.duplicate(true)
	var applied: Dictionary = {}
	for key in _dict(action.get("character_effects", {})).keys():
		var delta: float = _number(_dict(action.get("character_effects", {})).get(key, 0))
		var old_value: float = _number(character.get(key, 0))
		var new_value: float = old_value + delta
		if key in ["loyalty", "ambition", "integrity", "benevolence", "charisma"]:
			new_value = clampf(new_value, 0.0, 100.0)
		character[key] = roundi(new_value)
		applied[key] = roundi(new_value - old_value)
	character["last_personnel_action"] = str(action.get("name", action_id))
	character["last_personnel_turn"] = turn
	character["last_personnel_result"] = _character_action_outcome(character, action)
	characters[character_index] = character
	_sync_player_character_relation(character, action, applied)

	var variable_applied: Dictionary = {}
	for key in _dict(action.get("variable_effects", {})).keys():
		var variable_delta: float = _number(_dict(action.get("variable_effects", {})).get(key, 0))
		if variable_values.has(key):
			set_variable_value(str(key), variable_value(str(key)) + variable_delta)
			variable_applied[key] = variable_delta

	action_points -= cost
	neitang_money -= inner_cost
	var record: Dictionary = {
		"id": "character-action-%d-%s-%s" % [turn, character_id, action_id],
		"name": "%s：%s" % [str(character.get("name", character_id)), str(action.get("name", action_id))],
		"turn": turn,
		"year": year,
		"month": month,
		"character_id": character_id,
		"character_name": str(character.get("name", character_id)),
		"action_id": action_id,
		"action": str(action.get("name", action_id)),
		"cost": cost,
		"inner_treasury_cost": inner_cost,
		"outcome": str(character.get("last_personnel_result", "")),
		"description": _character_action_description(before, character, action, applied, variable_applied),
		"applied": applied,
		"variable_applied": variable_applied
	}
	character_action_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"character": character,
		"action": action,
		"record": record
	}

func _sync_player_character_relation(target: Dictionary, action: Dictionary, applied: Dictionary) -> void:
	if not applied.has("loyalty"):
		return
	var player: Dictionary = _player_character_identity()
	var player_id: String = str(player.get("id", ""))
	var player_name: String = str(player.get("name", ""))
	var target_id: String = str(target.get("id", ""))
	var target_name: String = str(target.get("name", ""))
	if player_id.is_empty() or target_id.is_empty() or player_id == target_id:
		return
	var delta: int = int(_number(applied.get("loyalty", 0)))
	if delta == 0:
		return
	var action_name: String = str(action.get("name", action.get("id", "人物处置")))
	var desc: String = "由人物处置同步：%s，忠诚变化 %+d。" % [action_name, delta]
	for i in range(character_relations.size()):
		var existing: Dictionary = _dict(character_relations[i]).duplicate(true)
		var from_endpoint: String = str(existing.get("from", ""))
		var to_endpoint: String = str(existing.get("to", ""))
		var forward: bool = _relationship_endpoint_matches(from_endpoint, player_id, player_name) and _relationship_endpoint_matches(to_endpoint, target_id, target_name)
		var reverse: bool = _relationship_endpoint_matches(from_endpoint, target_id, target_name) and _relationship_endpoint_matches(to_endpoint, player_id, player_name)
		if not forward and not reverse:
			continue
		var value: int = clampi(int(roundi(_relationship_entry_value(existing))) + delta, -100, 100)
		existing["value"] = value
		if str(existing.get("type", "")).is_empty():
			existing["type"] = "君臣"
		existing["desc"] = desc
		if str(existing.get("from", "")).is_empty():
			existing["from"] = player_name
		if str(existing.get("to", "")).is_empty():
			existing["to"] = target_name
		character_relations[i] = existing
		return
	character_relations.append({
		"id": "dynamic_character_relation_%s_%s" % [player_id, target_id],
		"from": player_name,
		"to": target_name,
		"type": "君臣",
		"value": clampi(delta, -100, 100),
		"desc": desc
	})

func _player_character_identity() -> Dictionary:
	var emperor_name: String = str(summary.get("emperor", ""))
	if not emperor_name.is_empty():
		var exact: Dictionary = character_by_name(emperor_name)
		if not exact.is_empty():
			return exact
		for raw in characters:
			var character: Dictionary = _dict(raw)
			var name: String = str(character.get("name", ""))
			if not name.is_empty() and (name.contains(emperor_name) or emperor_name.contains(name)):
				return character
	for raw in characters:
		var character: Dictionary = _dict(raw)
		var name: String = str(character.get("name", ""))
		var title: String = "%s %s" % [str(character.get("title", "")), str(character.get("official_title", ""))]
		if name == "朱由检" or title.contains("皇帝"):
			return character
	return {}

func office_holder_name(office_id: String) -> String:
	var holder_id: String = str(office_assignments.get(office_id, ""))
	if holder_id.is_empty():
		return ""
	return str(character_by_id(holder_id).get("name", ""))

func appoint_character(character_id: String, office_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var office: Dictionary = _office_by_id(office_id)
	if office.is_empty():
		return {
			"ok": false,
			"error": "unknown office: %s" % office_id
		}
	var character_index: int = _character_index_by_id(character_id)
	if character_index < 0:
		return {
			"ok": false,
			"error": "unknown character: %s" % character_id
		}
	var old_holder_id: String = str(office_assignments.get(office_id, ""))
	var old_holder_name: String = str(character_by_id(old_holder_id).get("name", "")) if not old_holder_id.is_empty() else ""
	var character: Dictionary = _dict(characters[character_index]).duplicate(true)
	var old_title: String = str(character.get("official_title", character.get("title", "")))
	var old_loyalty: float = _number(character.get("loyalty", 0))
	character["official_title"] = str(office.get("name", office_id))
	character["title"] = str(office.get("name", office_id))
	character["loyalty"] = minf(100.0, _number(character.get("loyalty", 0)) + 2.0)
	var loyalty_delta: int = int(roundi(_number(character.get("loyalty", 0)) - old_loyalty))
	characters[character_index] = character
	_sync_player_character_relation(character, {
		"id": "appointment",
		"name": "任命%s" % str(office.get("name", office_id))
	}, {
		"loyalty": loyalty_delta
	})
	office_assignments[office_id] = character_id
	if not old_holder_id.is_empty() and old_holder_id != character_id:
		_relieved_from_office(old_holder_id, office_id)
	action_points -= 1
	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"office_id": office_id,
		"office": str(office.get("name", office_id)),
		"character_id": character_id,
		"character": str(character.get("name", "")),
		"old_title": old_title,
		"old_holder_id": old_holder_id,
		"old_holder": old_holder_name,
		"loyalty_delta": loyalty_delta
	}
	appointment_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"record": record,
		"character": character,
		"office": office
	}

func _office_by_id(office_id: String) -> Dictionary:
	for raw in court_offices:
		var office: Dictionary = _dict(raw)
		if str(office.get("id", "")) == office_id:
			return office
	return {}

func _character_index_by_id(id: String) -> int:
	for i in range(characters.size()):
		var character: Dictionary = _dict(characters[i])
		if str(character.get("id", "")) == id:
			return i
	return -1

func _character_action_by_id(action_id: String) -> Dictionary:
	for raw in _default_character_actions():
		var action: Dictionary = _dict(raw)
		if str(action.get("id", "")) == action_id:
			return action
	return {}

func _character_action_outcome(character: Dictionary, action: Dictionary) -> String:
	var action_id: String = str(action.get("id", ""))
	match action_id:
		"reward":
			return "%s感恩受赐，忠诚稍固。" % str(character.get("name", "臣工"))
		"admonish":
			return "%s奉旨自省，锋芒稍敛。" % str(character.get("name", "臣工"))
		"inspect":
			if _number(character.get("integrity", 0)) >= 70.0:
				return "%s考语尚清，可备拔擢。" % str(character.get("name", "臣工"))
			if _number(character.get("integrity", 0)) <= 40.0:
				return "%s考语可疑，宜再核其事。" % str(character.get("name", "臣工"))
			return "%s考语平实，暂照旧任用。" % str(character.get("name", "臣工"))
	return "%s已奉旨处置。" % str(character.get("name", "臣工"))

func _character_action_description(before: Dictionary, after: Dictionary, action: Dictionary, applied: Dictionary, variable_applied: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for key in applied.keys():
		var label: String = _character_stat_label(str(key))
		var old_value: int = int(_number(before.get(key, 0)))
		var new_value: int = int(_number(after.get(key, 0)))
		parts.append("%s %d→%d" % [label, old_value, new_value])
	for key in variable_applied.keys():
		parts.append("%s %s" % [str(key), _signed_big(_number(variable_applied.get(key, 0)), "")])
	if parts.is_empty():
		return str(action.get("description", ""))
	return "，".join(parts)

func _character_stat_label(key: String) -> String:
	match key:
		"loyalty":
			return "忠诚"
		"ambition":
			return "野心"
		"integrity":
			return "廉洁"
		"benevolence":
			return "仁德"
		"charisma":
			return "声望"
	return key

func _relieved_from_office(character_id: String, _office_id: String) -> void:
	var index: int = _character_index_by_id(character_id)
	if index < 0:
		return
	var character: Dictionary = _dict(characters[index]).duplicate(true)
	character["official_title"] = "候任"
	character["title"] = "候任"
	characters[index] = character

func issue_edict(edict_id: String, target_region_id: String = "") -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var edict: Dictionary = _edict_template_by_id(edict_id)
	if edict.is_empty():
		return {
			"ok": false,
			"error": "unknown edict: %s" % edict_id
		}
	var cost: int = max(1, int(_number(edict.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var target_index: int = -1
	var target_region: Dictionary = {}
	var requires_target: bool = bool(edict.get("requires_target", false))
	if requires_target or not target_region_id.is_empty():
		target_index = _region_index_by_id(target_region_id)
		if target_index < 0:
			return {
				"ok": false,
				"error": "unknown target region: %s" % target_region_id
			}
		target_region = _dict(map_regions[target_index]).duplicate(true)

	var applied: Dictionary = _apply_effects(_dict(edict.get("effects", {})))
	var region_applied: Dictionary = {}
	if target_index >= 0:
		region_applied = _apply_region_effects(target_index, _dict(edict.get("region_effects", {})))
	action_points -= cost

	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": edict_id,
		"name": str(edict.get("name", edict_id)),
		"category": str(edict.get("category", "")),
		"cost": cost,
		"target_region_id": target_region_id,
		"target_region": str(target_region.get("name", "")),
		"applied": applied,
		"region_applied": region_applied
	}
	issued_edicts.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"edict": edict,
		"record": record,
		"target_region": target_region,
		"applied": applied,
		"region_applied": region_applied
	}

func _edict_template_by_id(edict_id: String) -> Dictionary:
	for raw in edict_templates:
		var edict: Dictionary = _dict(raw)
		if str(edict.get("id", "")) == edict_id:
			return edict
	return {}

func _region_index_by_id(id: String) -> int:
	for i in range(map_regions.size()):
		var region: Dictionary = _dict(map_regions[i])
		if str(region.get("id", "")) == id or str(region.get("name", "")) == id:
			return i
	return -1

func region_governance_actions() -> Array:
	return _default_region_governance_actions()

func perform_region_governance(region_id: String, action_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var action: Dictionary = _region_governance_action_by_id(action_id)
	if action.is_empty():
		return {
			"ok": false,
			"error": "unknown region governance action: %s" % action_id
		}
	var target_index: int = _region_index_by_id(region_id)
	if target_index < 0:
		return {
			"ok": false,
			"error": "unknown target region: %s" % region_id
		}
	var cost: int = maxi(1, int(_number(action.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var target_before: Dictionary = _dict(map_regions[target_index]).duplicate(true)
	var assignment: Dictionary = _apply_region_assignment(target_index, action)
	if assignment.has("ok") and not bool(assignment.get("ok", false)):
		return {
			"ok": false,
			"error": str(assignment.get("error", "regional assignment failed"))
		}
	var applied: Dictionary = _apply_effects(_dict(action.get("effects", {})))
	var region_applied: Dictionary = _apply_region_effects(target_index, _dict(action.get("region_effects", {})))
	var target_after: Dictionary = _dict(map_regions[target_index]).duplicate(true)
	action_points -= cost
	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": "region-governance-%d-%s-%s" % [turn, region_id, action_id],
		"name": "%s：%s" % [str(target_after.get("name", region_id)), str(action.get("name", action_id))],
		"category": str(action.get("category", "")),
		"cost": cost,
		"target_region_id": region_id,
		"target_region": str(target_after.get("name", "")),
		"action_id": action_id,
		"action": str(action.get("name", action_id)),
		"outcome": _region_governance_outcome(target_before, target_after, action),
		"description": _region_governance_description(target_before, target_after, action),
		"applied": applied,
		"region_applied": region_applied,
		"assignment": assignment,
		"assigned_person_id": str(assignment.get("person_id", "")),
		"assigned_person": str(assignment.get("person", ""))
	}
	region_governance_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"action": action,
		"record": record,
		"target_region": target_after,
		"applied": applied,
		"region_applied": region_applied
	}

func _region_governance_action_by_id(action_id: String) -> Dictionary:
	for raw in _default_region_governance_actions():
		var action: Dictionary = _dict(raw)
		if str(action.get("id", "")) == action_id:
			return action
	return {}

func _region_governance_outcome(_before: Dictionary, after: Dictionary, action: Dictionary) -> String:
	var name: String = str(after.get("name", "此地"))
	match str(action.get("id", "")):
		"relief":
			return "%s已行赈抚，民怨稍息。" % name
		"survey":
			return "%s已清丈核册，赋役账目稍明。" % name
		"fortify":
			return "%s已修防备，兵压稍缓。" % name
		"appoint_governor":
			return "%s已简任地方主官，政务有专责。" % name
		"appoint_commander":
			return "%s已简任统兵将领，营伍稍有统属。" % name
	return "%s已行地方治理。" % name

func _region_governance_description(before: Dictionary, after: Dictionary, _action: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for key in ["governor", "commander"]:
		var old_text: String = str(before.get(key, "未任"))
		var new_text: String = str(after.get(key, "未任"))
		if old_text != new_text:
			parts.append("%s %s→%s" % [_region_field_label(key), old_text, new_text])
	for key in ["mood", "unrest", "tax_pressure", "army_pressure", "prosperity", "development", "troops"]:
		var old_value: float = _number(before.get(key, 0))
		var new_value: float = _number(after.get(key, 0))
		if not is_equal_approx(old_value, new_value):
			parts.append("%s %s→%s" % [_region_field_label(key), fmt_big(old_value, ""), fmt_big(new_value, "")])
	if parts.is_empty():
		return "地块数值未发生变化。"
	return "，".join(parts)

func _region_field_label(key: String) -> String:
	match key:
		"mood":
			return "民心"
		"unrest":
			return "不稳"
		"tax_pressure":
			return "税压"
		"army_pressure":
			return "兵压"
		"prosperity":
			return "繁荣"
		"development":
			return "开发"
		"troops":
			return "驻军"
		"governor":
			return "主官"
		"commander":
			return "统兵"
	return key

func _apply_region_assignment(region_index: int, action: Dictionary) -> Dictionary:
	var role: String = str(action.get("assign_role", ""))
	if role.is_empty():
		return {}
	if region_index < 0 or region_index >= map_regions.size():
		return {
			"ok": false,
			"error": "unknown target region"
		}
	var region: Dictionary = _dict(map_regions[region_index]).duplicate(true)
	var ability_key: String = str(action.get("assign_ability", "administration"))
	var candidate: Dictionary = _best_region_assignment_candidate(region, role, ability_key)
	if candidate.is_empty():
		return {
			"ok": false,
			"error": "no eligible regional assignment candidate"
		}

	var person_id: String = str(candidate.get("id", ""))
	var person_name: String = str(candidate.get("name", ""))
	var previous_person: String = ""
	match role:
		"governor":
			previous_person = str(region.get("governor", ""))
			region["governor_id"] = person_id
			region["governor"] = person_name
			region["governor_title"] = "地方主官"
		"commander":
			previous_person = str(region.get("commander", ""))
			region["commander_id"] = person_id
			region["commander"] = person_name
			region["commander_title"] = "统兵将领"
		_:
			return {
				"ok": false,
				"error": "unknown regional assignment role: %s" % role
			}
	map_regions[region_index] = region
	_mark_character_regional_assignment(person_id, role, region)
	return {
		"ok": true,
		"role": role,
		"person_id": person_id,
		"person": person_name,
		"previous_person": previous_person,
		"region_id": str(region.get("id", "")),
		"region": str(region.get("name", ""))
	}

func _best_region_assignment_candidate(region: Dictionary, role: String, ability_key: String) -> Dictionary:
	var best: Dictionary = {}
	var best_score: float = -999999.0
	for raw in characters:
		var character: Dictionary = _dict(raw)
		var character_id: String = str(character.get("id", ""))
		if character_id.is_empty():
			continue
		if _is_character_unavailable_for_assignment(character):
			continue
		var score: float = _region_assignment_score(character, region, role, ability_key)
		if _is_assigned_to_region_role(character_id, role):
			score -= 35.0
		if score > best_score:
			best_score = score
			best = character
	return best

func _region_assignment_score(character: Dictionary, region: Dictionary, role: String, ability_key: String) -> float:
	var score: float = 0.0
	if role == "commander":
		score += maxf(_number(character.get("military", 0)), _number(character.get("valor", 0))) * 1.20
		score += _number(character.get("loyalty", 50)) * 0.18
		score += _number(character.get("intelligence", 0)) * 0.08
	else:
		score += _number(character.get(ability_key, 0)) * 1.15
		score += _number(character.get("integrity", 50)) * 0.18
		score += _number(character.get("loyalty", 50)) * 0.16
		score += _number(character.get("intelligence", 0)) * 0.08
	if _character_matches_region_owner(character, region):
		score += 28.0
	if str(character.get("location", "")) == str(region.get("name", "")):
		score += 5.0
	return score

func _is_character_unavailable_for_assignment(character: Dictionary) -> bool:
	var title: String = str(character.get("official_title", character.get("title", "")))
	if title.contains("已罢") or title.contains("闲居") or title.contains("丁忧"):
		return true
	var status: String = str(character.get("status", ""))
	return status.contains("亡") or status.contains("死")

func _character_matches_region_owner(character: Dictionary, region: Dictionary) -> bool:
	var faction: String = str(character.get("faction", ""))
	var owner: String = str(region.get("owner", region.get("owner_id", "")))
	var controller: String = str(region.get("controller", region.get("controller_id", "")))
	if owner.is_empty() and controller.is_empty():
		return faction.contains("明")
	return (not owner.is_empty() and (faction.contains(owner) or owner.contains(faction))) or (not controller.is_empty() and (faction.contains(controller) or controller.contains(faction)))

func _is_assigned_to_region_role(character_id: String, role: String) -> bool:
	var field: String = "governor_id" if role == "governor" else "commander_id"
	for raw in map_regions:
		var region: Dictionary = _dict(raw)
		if str(region.get(field, "")) == character_id:
			return true
	return false

func _mark_character_regional_assignment(character_id: String, role: String, region: Dictionary) -> void:
	var index: int = _character_index_by_id(character_id)
	if index < 0:
		return
	var character: Dictionary = _dict(characters[index]).duplicate(true)
	character["location"] = str(region.get("name", character.get("location", "")))
	character["regional_assignment_role"] = role
	character["regional_assignment_region_id"] = str(region.get("id", ""))
	character["regional_assignment_region"] = str(region.get("name", ""))
	characters[index] = character

func _apply_region_effects(region_index: int, effects: Dictionary) -> Dictionary:
	var applied: Dictionary = {}
	if region_index < 0 or region_index >= map_regions.size():
		return applied
	var region: Dictionary = _dict(map_regions[region_index]).duplicate(true)
	var keys: Array = effects.keys()
	keys.sort()
	for key in keys:
		var field: String = str(key)
		var delta: float = _number(effects[key])
		var before: float = _number(region.get(field, 0))
		var after: float = before + delta
		match field:
			"mood", "unrest", "tax_pressure", "army_pressure", "prosperity", "development":
				after = clampf(after, 0.0, 100.0)
				region[field] = roundi(after)
			"troops":
				after = maxf(0.0, after)
				region[field] = roundi(after)
			_:
				region[field] = after
		applied[field] = delta
	map_regions[region_index] = region
	return applied

func issue_military_order(order_id: String, target_region_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var order: Dictionary = _military_order_by_id(order_id)
	if order.is_empty():
		return {
			"ok": false,
			"error": "unknown military order: %s" % order_id
		}
	var target_index: int = _region_index_by_id(target_region_id)
	if target_index < 0:
		return {
			"ok": false,
			"error": "unknown target region: %s" % target_region_id
		}
	var cost: int = max(1, int(_number(order.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var target_region: Dictionary = _dict(map_regions[target_index]).duplicate(true)
	var applied: Dictionary = _apply_effects(_dict(order.get("effects", {})))
	var region_applied: Dictionary = _apply_region_effects(target_index, _dict(order.get("region_effects", {})))
	action_points -= cost

	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": order_id,
		"name": str(order.get("name", order_id)),
		"category": str(order.get("category", "")),
		"cost": cost,
		"target_region_id": target_region_id,
		"target_region": str(target_region.get("name", "")),
		"applied": applied,
		"region_applied": region_applied
	}
	issued_military_orders.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"order": order,
		"record": record,
		"target_region": target_region,
		"applied": applied,
		"region_applied": region_applied
	}

func appoint_army_commander(army_id: String, character_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var army_index: int = _army_index_by_id(army_id)
	if army_index < 0:
		return {
			"ok": false,
			"error": "unknown army: %s" % army_id
		}
	var character_index: int = _character_index_by_id(character_id)
	if character_index < 0:
		return {
			"ok": false,
			"error": "unknown character: %s" % character_id
		}
	var cost: int = 1
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var army: Dictionary = _dict(armies[army_index]).duplicate(true)
	var character: Dictionary = _dict(characters[character_index]).duplicate(true)
	var previous_commander: String = str(army.get("commander", ""))
	var previous_commander_id: String = str(army.get("commander_id", ""))
	var army_name: String = str(army.get("name", army_id))
	var character_name: String = str(character.get("name", character_id))
	var character_title: String = str(character.get("official_title", character.get("title", "")))

	army["commander_id"] = character_id
	army["commander"] = character_name
	army["commander_title"] = character_title
	armies[army_index] = army

	if not previous_commander_id.is_empty() and previous_commander_id != character_id:
		_clear_character_army_command(previous_commander_id, army_id)
	character["army_command_id"] = army_id
	character["army_command_name"] = army_name
	character["army_command_role"] = "commander"
	var army_location: String = str(army.get("garrison", army.get("location", "")))
	if not army_location.is_empty():
		character["location"] = army_location
	characters[character_index] = character

	action_points -= cost
	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": "army-command-%d-%s" % [turn, army_id],
		"name": "%s统帅更易" % army_name,
		"cost": cost,
		"army_id": army_id,
		"army": army_name,
		"old_commander_id": previous_commander_id,
		"old_commander": previous_commander,
		"commander_id": character_id,
		"commander": character_name,
		"description": "%s统帅由%s改为%s。" % [
			army_name,
			previous_commander if not previous_commander.is_empty() else "未定",
			character_name
		]
	}
	army_command_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"record": record,
		"army": army,
		"character": character
	}

func army_actions() -> Array:
	return _default_army_actions()

func issue_army_action(action_id: String, army_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var action: Dictionary = _army_action_by_id(action_id)
	if action.is_empty():
		return {
			"ok": false,
			"error": "unknown army action: %s" % action_id
		}
	var army_index: int = _army_index_by_id(army_id)
	if army_index < 0:
		return {
			"ok": false,
			"error": "unknown army: %s" % army_id
		}
	var cost: int = max(1, int(_number(action.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var army_before: Dictionary = _dict(armies[army_index]).duplicate(true)
	var army_name: String = str(army_before.get("name", army_id))
	var target_region_index: int = _army_garrison_region_index(army_before)
	var needs_garrison_region: bool = action.has("region_effects") or bool(action.get("restore_owner_control", false))
	if needs_garrison_region and target_region_index < 0:
		return {
			"ok": false,
			"error": "army garrison region not found"
		}
	var applied: Dictionary = _apply_effects(_dict(action.get("effects", {})))
	var army_applied: Dictionary = _apply_army_effects(army_index, _dict(action.get("army_effects", {})))
	var region_applied: Dictionary = {}
	var region_control: Dictionary = {}
	var target_region_id: String = ""
	var target_region_name: String = ""
	if target_region_index >= 0 and action.has("region_effects"):
		region_applied = _apply_region_effects(target_region_index, _dict(action.get("region_effects", {})))
	if target_region_index >= 0 and bool(action.get("restore_owner_control", false)):
		region_control = _restore_region_owner_control(target_region_index, str(action.get("name", action_id)))
	if target_region_index >= 0 and needs_garrison_region:
		var target_region: Dictionary = _dict(map_regions[target_region_index])
		target_region_id = str(target_region.get("id", ""))
		target_region_name = _region_display_name(target_region)
	action_points -= cost

	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": "army-action-%d-%s-%s" % [turn, action_id, army_id],
		"action_id": action_id,
		"name": str(action.get("name", action_id)),
		"category": str(action.get("category", "")),
		"cost": cost,
		"army_id": army_id,
		"army": army_name,
		"target_region_id": target_region_id,
		"target_region": target_region_name,
		"applied": applied,
		"army_applied": army_applied,
		"region_applied": region_applied,
		"region_control": region_control,
		"description": "%s：%s" % [army_name, str(action.get("desc", ""))]
	}
	army_action_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"action": action,
		"record": record,
		"army": _dict(armies[army_index]),
		"applied": applied,
		"army_applied": army_applied,
		"region_applied": region_applied,
		"region_control": region_control
	}

func redeploy_army(army_id: String, target_region_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var army_index: int = _army_index_by_id(army_id)
	if army_index < 0:
		return {
			"ok": false,
			"error": "unknown army: %s" % army_id
		}
	var target_index: int = _region_index_by_id(target_region_id)
	if target_index < 0:
		return {
			"ok": false,
			"error": "unknown target region: %s" % target_region_id
		}
	var cost: int = 1
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var army: Dictionary = _dict(armies[army_index]).duplicate(true)
	var army_name: String = str(army.get("name", army_id))
	var source_name: String = str(army.get("garrison", army.get("location", "")))
	var source_index: int = _region_index_by_id(source_name)
	var target_region: Dictionary = _dict(map_regions[target_index]).duplicate(true)
	var target_name: String = _region_display_name(target_region)
	if source_index == target_index:
		return {
			"ok": false,
			"error": "army already deployed to target region"
		}

	var moved_troops: int = max(0, int(_number(army.get("soldiers", 0))))
	if moved_troops <= 0:
		moved_troops = 1000
	var source_region_name: String = source_name
	if source_index >= 0:
		var source_region: Dictionary = _dict(map_regions[source_index]).duplicate(true)
		source_region_name = _region_display_name(source_region)
		source_region["troops"] = max(0, int(_number(source_region.get("troops", 0))) - moved_troops)
		source_region["army_pressure"] = clampi(int(_number(source_region.get("army_pressure", 0))) - 2, 0, 100)
		map_regions[source_index] = source_region
	target_region["troops"] = max(0, int(_number(target_region.get("troops", 0))) + moved_troops)
	target_region["army_pressure"] = clampi(int(_number(target_region.get("army_pressure", 0))) + 2, 0, 100)
	map_regions[target_index] = target_region

	army["source_garrison"] = source_region_name
	army["garrison"] = target_name
	army["location"] = target_name
	army["region_id"] = str(target_region.get("id", target_region_id))
	army["activity"] = "调防至%s" % target_name
	armies[army_index] = army

	var commander_id: String = str(army.get("commander_id", ""))
	if not commander_id.is_empty():
		var character_index: int = _character_index_by_id(commander_id)
		if character_index >= 0:
			var commander: Dictionary = _dict(characters[character_index]).duplicate(true)
			commander["location"] = target_name
			characters[character_index] = commander

	action_points -= cost
	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": "army-redeploy-%d-%s-%s" % [turn, army_id, str(target_region.get("id", target_region_id))],
		"name": "%s调防" % army_name,
		"cost": cost,
		"army_id": army_id,
		"army": army_name,
		"source_region": source_region_name,
		"target_region_id": str(target_region.get("id", target_region_id)),
		"target_region": target_name,
		"moved_troops": moved_troops,
		"description": "%s由%s调防至%s，移兵%s。" % [army_name, source_region_name, target_name, fmt_big(moved_troops, "人")]
	}
	army_redeployment_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"record": record,
		"army": army,
		"source_region": _dict(map_regions[source_index]) if source_index >= 0 else {},
		"target_region": _dict(map_regions[target_index])
	}

func _military_order_by_id(order_id: String) -> Dictionary:
	for raw in military_order_templates:
		var order: Dictionary = _dict(raw)
		if str(order.get("id", "")) == order_id:
			return order
	return {}

func _army_action_by_id(action_id: String) -> Dictionary:
	for raw in _default_army_actions():
		var action: Dictionary = _dict(raw)
		if str(action.get("id", "")) == action_id:
			return action
	return {}

func _army_garrison_region_index(army: Dictionary) -> int:
	var region_id: String = str(army.get("region_id", ""))
	if not region_id.is_empty():
		var by_id: int = _region_index_by_id(region_id)
		if by_id >= 0:
			return by_id
	var garrison: String = str(army.get("garrison", army.get("location", "")))
	if garrison.is_empty():
		garrison = str(army.get("location", ""))
	if garrison.is_empty():
		return -1
	return _region_index_by_id(garrison)

func _apply_army_effects(army_index: int, effects: Dictionary) -> Dictionary:
	var applied: Dictionary = {}
	if army_index < 0 or army_index >= armies.size():
		return applied
	var army: Dictionary = _dict(armies[army_index]).duplicate(true)
	var keys: Array = effects.keys()
	keys.sort()
	for key in keys:
		var field: String = str(key)
		var delta: float = _number(effects[key])
		var before: float = _number(army.get(field, 0))
		if field == "control" or field == "control_level":
			before = _number(army.get("control", army.get("control_level", 0)))
		var after: float = before + delta
		match field:
			"morale", "training", "loyalty", "mutiny_risk", "supply":
				after = clampf(after, 0.0, 100.0)
				army[field] = roundi(after)
			"control", "control_level":
				after = clampf(after, 0.0, 100.0)
				army["control"] = roundi(after)
				army["control_level"] = roundi(after)
			"pay_arrears_months":
				after = maxf(0.0, after)
				army[field] = roundi(after)
				army["salary_status"] = "欠饷%d月" % roundi(after)
			"soldiers":
				after = maxf(0.0, after)
				army[field] = roundi(after)
				army["soldiers_text"] = fmt_big(after, "人")
			_:
				army[field] = after
		applied[field] = delta
	if effects.has("pay_arrears_months"):
		var arrears: int = int(_number(army.get("pay_arrears_months", 0)))
		var salary_text: String = str(army.get("salary_text", ""))
		if salary_text.is_empty():
			army["salary_text"] = "欠饷%d月" % arrears
		else:
			army["salary_text"] = "%s；当前欠饷%d月" % [salary_text, arrears]
	armies[army_index] = army
	return applied

func _restore_region_owner_control(region_index: int, reason: String = "") -> Dictionary:
	if region_index < 0 or region_index >= map_regions.size():
		return {
			"ok": false,
			"error": "unknown target region"
		}
	var region: Dictionary = _dict(map_regions[region_index]).duplicate(true)
	var owner_id: String = str(region.get("owner_id", ""))
	var owner_name: String = str(region.get("owner", ""))
	if owner_id.is_empty():
		owner_id = owner_name
	if owner_name.is_empty():
		owner_name = owner_id
	if owner_id.is_empty() and owner_name.is_empty():
		return {
			"ok": false,
			"error": "target region has no legal owner"
		}

	var before_controller_id: String = str(region.get("controller_id", ""))
	var before_controller: String = str(region.get("controller", ""))
	if before_controller_id.is_empty():
		before_controller_id = before_controller
	if before_controller.is_empty():
		before_controller = before_controller_id
	var unchanged: bool = before_controller_id == owner_id and before_controller == owner_name

	region["controller_id"] = owner_id
	region["controller"] = owner_name
	region["last_control_turn"] = turn
	if not reason.is_empty():
		region["last_control_reason"] = reason
	map_regions[region_index] = region

	var previous_controller_index: int = _faction_index_by_identity(before_controller_id, before_controller)
	if previous_controller_index >= 0:
		_refresh_faction_territory_summary(previous_controller_index)
	var owner_index: int = _faction_index_by_identity(owner_id, owner_name)
	if owner_index >= 0 and owner_index != previous_controller_index:
		_refresh_faction_territory_summary(owner_index)

	return {
		"ok": true,
		"unchanged": unchanged,
		"region_id": str(region.get("id", "")),
		"region": _region_display_name(region),
		"before_controller_id": before_controller_id,
		"before_controller": before_controller,
		"after_controller_id": owner_id,
		"after_controller": owner_name,
		"owner_id": owner_id,
		"owner": owner_name,
		"reason": reason
	}

func _army_index_by_id(army_id: String) -> int:
	for i in range(armies.size()):
		var army: Dictionary = _dict(armies[i])
		if str(army.get("id", "")) == army_id:
			return i
	return -1

func _clear_character_army_command(character_id: String, army_id: String) -> void:
	var index: int = _character_index_by_id(character_id)
	if index < 0:
		return
	var character: Dictionary = _dict(characters[index]).duplicate(true)
	if str(character.get("army_command_id", "")) != army_id:
		return
	character.erase("army_command_id")
	character.erase("army_command_name")
	character.erase("army_command_role")
	characters[index] = character

func issue_diplomacy_action(action_id: String, target_faction_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var action: Dictionary = _diplomacy_action_by_id(action_id)
	if action.is_empty():
		return {
			"ok": false,
			"error": "unknown diplomacy action: %s" % action_id
		}
	var target_index: int = _faction_index_by_id(target_faction_id)
	if target_index < 0:
		return {
			"ok": false,
			"error": "unknown target faction: %s" % target_faction_id
		}
	var cost: int = max(1, int(_number(action.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var target_faction: Dictionary = _dict(factions[target_index]).duplicate(true)
	var applied: Dictionary = _apply_effects(_dict(action.get("effects", {})))
	var faction_applied: Dictionary = _apply_faction_effects(target_index, _dict(action.get("faction_effects", {})))
	_add_diplomacy_commitment(action, target_index)
	action_points -= cost

	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": action_id,
		"name": str(action.get("name", action_id)),
		"category": str(action.get("category", "")),
		"cost": cost,
		"target_faction_id": target_faction_id,
		"target_faction": str(target_faction.get("name", "")),
		"applied": applied,
		"faction_applied": faction_applied
	}
	diplomacy_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"action": action,
		"record": record,
		"target_faction": target_faction,
		"applied": applied,
		"faction_applied": faction_applied
	}

func renew_diplomacy_commitment(commitment_id: String, target_faction_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var commitment_index: int = _diplomacy_commitment_index(commitment_id, target_faction_id)
	if commitment_index < 0:
		return {
			"ok": false,
			"error": "active diplomacy commitment not found"
		}
	var action: Dictionary = _diplomacy_action_by_id(commitment_id)
	var template: Dictionary = _dict(action.get("commitment", {}))
	var duration: int = max(1, int(_number(template.get("duration_months", 1))))
	var cost: int = max(1, int(_number(template.get("renew_cost", action.get("cost", 1)))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}
	var target_index: int = _faction_index_by_id(target_faction_id)
	if target_index < 0:
		return {
			"ok": false,
			"error": "unknown target faction: %s" % target_faction_id
		}

	var commitment: Dictionary = _dict(active_diplomacy_commitments[commitment_index]).duplicate(true)
	commitment["remaining_months"] = int(_number(commitment.get("remaining_months", 0))) + duration
	commitment["renewed_turn"] = turn
	active_diplomacy_commitments[commitment_index] = commitment
	action_points -= cost

	var target_faction: Dictionary = _dict(factions[target_index])
	_append_faction_memory(target_index, {
		"kind": "renewed_commitment",
		"commitment_id": commitment_id,
		"commitment": str(commitment.get("name", commitment_id)),
		"remaining_months": int(_number(commitment.get("remaining_months", 0))),
		"trust_delta": 2
	})
	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"kind": "renew_commitment",
		"id": commitment_id,
		"name": str(commitment.get("name", commitment_id)),
		"target_faction_id": target_faction_id,
		"target_faction": str(target_faction.get("name", "")),
		"cost": cost,
		"remaining_months": int(_number(commitment.get("remaining_months", 0)))
	}
	diplomacy_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"commitment": commitment,
		"record": record
	}

func break_diplomacy_commitment(commitment_id: String, target_faction_id: String) -> Dictionary:
	var commitment_index: int = _diplomacy_commitment_index(commitment_id, target_faction_id)
	if commitment_index < 0:
		return {
			"ok": false,
			"error": "active diplomacy commitment not found"
		}
	var target_index: int = _faction_index_by_id(target_faction_id)
	if target_index < 0:
		return {
			"ok": false,
			"error": "unknown target faction: %s" % target_faction_id
		}

	var commitment: Dictionary = _dict(active_diplomacy_commitments[commitment_index]).duplicate(true)
	active_diplomacy_commitments.remove_at(commitment_index)
	var faction_applied: Dictionary = _apply_faction_effects(target_index, {
		"relation_to_player": -12,
		"hostility": 12,
		"cohesion": -3
	})
	var faction: Dictionary = _dict(factions[target_index]).duplicate(true)
	faction["ming_support"] = 0
	factions[target_index] = faction
	_append_faction_memory(target_index, {
		"kind": "broken_commitment",
		"commitment_id": commitment_id,
		"commitment": str(commitment.get("name", commitment_id)),
		"trust_delta": -12,
		"hostility_delta": 12
	})

	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"kind": "break_commitment",
		"id": commitment_id,
		"name": str(commitment.get("name", commitment_id)),
		"target_faction_id": target_faction_id,
		"target_faction": str(faction.get("name", "")),
		"cost": 0,
		"faction_applied": faction_applied
	}
	diplomacy_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"commitment": commitment,
		"record": record,
		"faction_applied": faction_applied
	}

func _diplomacy_commitment_index(commitment_id: String, target_faction_id: String) -> int:
	for i in range(active_diplomacy_commitments.size()):
		var commitment: Dictionary = _dict(active_diplomacy_commitments[i])
		if str(commitment.get("id", "")) == commitment_id and str(commitment.get("target_faction_id", "")) == target_faction_id:
			return i
	return -1

func _append_faction_memory(faction_index: int, entry: Dictionary) -> void:
	if faction_index < 0 or faction_index >= factions.size():
		return
	var faction: Dictionary = _dict(factions[faction_index]).duplicate(true)
	var memory: Array = _array(faction.get("diplomacy_memory", [])).duplicate(true)
	var item: Dictionary = entry.duplicate(true)
	item["turn"] = turn
	item["year"] = year
	item["month"] = month
	memory.append(item)
	while memory.size() > 20:
		memory.remove_at(0)
	faction["diplomacy_memory"] = memory
	factions[faction_index] = faction

func _add_diplomacy_commitment(action: Dictionary, target_index: int) -> void:
	var commitment_template: Dictionary = _dict(action.get("commitment", {}))
	if commitment_template.is_empty() or target_index < 0 or target_index >= factions.size():
		return
	var target_faction: Dictionary = _dict(factions[target_index])
	var commitment_id: String = str(commitment_template.get("id", action.get("id", "")))
	var target_id: String = str(target_faction.get("id", ""))
	for i in range(active_diplomacy_commitments.size()):
		var existing: Dictionary = _dict(active_diplomacy_commitments[i]).duplicate(true)
		if str(existing.get("id", "")) == commitment_id and str(existing.get("target_faction_id", "")) == target_id:
			existing["remaining_months"] = max(int(_number(existing.get("remaining_months", 0))), int(_number(commitment_template.get("duration_months", 1))))
			active_diplomacy_commitments[i] = existing
			return
	active_diplomacy_commitments.append({
		"id": commitment_id,
		"name": str(commitment_template.get("name", action.get("name", commitment_id))),
		"target_faction_id": target_id,
		"target_faction": str(target_faction.get("name", "")),
		"started_turn": turn,
		"remaining_months": int(_number(commitment_template.get("duration_months", 1))),
		"effects": _dict(commitment_template.get("effects", {})).duplicate(true)
	})

func _tick_diplomacy_commitments() -> void:
	var remaining: Array = []
	for raw in active_diplomacy_commitments:
		var commitment: Dictionary = _dict(raw).duplicate(true)
		commitment["remaining_months"] = int(_number(commitment.get("remaining_months", 0))) - 1
		if int(_number(commitment.get("remaining_months", 0))) > 0:
			remaining.append(commitment)
		else:
			_expire_diplomacy_commitment(commitment)
	active_diplomacy_commitments = remaining

func _expire_diplomacy_commitment(commitment: Dictionary) -> void:
	if str(commitment.get("id", "")) != "support_chahar":
		return
	var target_id: String = str(commitment.get("target_faction_id", ""))
	var target_index: int = _faction_index_by_id(target_id)
	if target_index < 0:
		return
	var faction: Dictionary = _dict(factions[target_index]).duplicate(true)
	faction["ming_support"] = 0
	factions[target_index] = faction

func _diplomacy_action_by_id(action_id: String) -> Dictionary:
	for raw in diplomacy_actions:
		var action: Dictionary = _dict(raw)
		if str(action.get("id", "")) == action_id:
			return action
	return {}

func _faction_index_by_id(id: String) -> int:
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i])
		if str(faction.get("id", "")) == id or str(faction.get("name", "")) == id:
			return i
	return -1

func _faction_action_by_id(action_id: String) -> Dictionary:
	for raw in _default_faction_actions():
		var action: Dictionary = _dict(raw)
		if str(action.get("id", "")) == action_id:
			return action
	return {}

func _faction_action_outcome(_before: Dictionary, after: Dictionary, action: Dictionary, region_transfer: Dictionary = {}) -> String:
	var name: String = str(after.get("name", "目标势力"))
	match str(action.get("id", "")):
		"spy_network":
			return "%s情报脉络稍明，后续判断更有据。" % name
		"sow_discord":
			return "%s内部离心渐起，凝聚有所下滑。" % name
		"appease_elites":
			return "%s上层稍受笼络，对朝廷敌意略降。" % name
		"economic_pressure":
			return "%s贸易受压，边境张力上升。" % name
		"assert_suzerainty":
			if not region_transfer.is_empty() and bool(region_transfer.get("ok", false)):
				return "%s所据%s已改隶大明，封疆归属重定。" % [
					name,
					str(region_transfer.get("region", "地块"))
				]
			return "%s所属地块已改隶大明，封疆归属重定。" % name
	return "%s已受朝廷应对。" % name

func _faction_action_description(before: Dictionary, after: Dictionary, _action: Dictionary, region_transfer: Dictionary = {}) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for key in ["relation_to_player", "hostility", "cohesion", "border_tension", "trade_access", "tribute_pressure", "public_opinion", "military_strength", "economy"]:
		var old_value: float = _number(before.get(key, 0))
		var new_value: float = _number(after.get(key, 0))
		if not is_equal_approx(old_value, new_value):
			parts.append("%s %s→%s" % [_faction_field_label(key), fmt_big(old_value, ""), fmt_big(new_value, "")])
	if not region_transfer.is_empty() and bool(region_transfer.get("ok", false)):
		parts.append("%s 归属 %s→%s" % [
			str(region_transfer.get("region", "地块")),
			str(region_transfer.get("before_owner", "")),
			str(region_transfer.get("after_owner", ""))
		])
	if parts.is_empty():
		return "势力数值未发生变化。"
	return "，".join(parts)

func _faction_field_label(key: String) -> String:
	match key:
		"relation_to_player":
			return "对明关系"
		"hostility":
			return "敌意"
		"cohesion":
			return "凝聚"
		"border_tension":
			return "边境张力"
		"trade_access":
			return "互市"
		"tribute_pressure":
			return "输诚压力"
		"public_opinion":
			return "民意"
		"military_strength":
			return "军力"
		"economy":
			return "财力"
	return key

func _apply_faction_effects(faction_index: int, effects: Dictionary) -> Dictionary:
	var applied: Dictionary = {}
	if faction_index < 0 or faction_index >= factions.size():
		return applied
	var faction: Dictionary = _dict(factions[faction_index]).duplicate(true)
	var keys: Array = effects.keys()
	keys.sort()
	for key in keys:
		var field: String = str(key)
		var delta: float = _number(effects[key])
		var before: float = _number(faction.get(field, 0))
		var after: float = before + delta
		match field:
			"relation_to_player", "hostility", "border_tension", "trade_access", "tribute_pressure", "cohesion", "public_opinion":
				after = clampf(after, 0.0, 100.0)
				faction[field] = roundi(after)
			"military_strength":
				after = maxf(0.0, after)
				faction[field] = roundi(after)
			_:
				faction[field] = after
		applied[field] = delta
	var relation: int = int(_number(faction.get("relation_to_player", 0)))
	var hostility: int = int(_number(faction.get("hostility", 0)))
	faction["relations_text"] = "对大明关系 %d · 敌意 %d" % [relation, hostility]
	faction["attitude"] = _faction_attitude_from_scores(relation, hostility)
	factions[faction_index] = faction
	if effects.has("relation_to_player") or effects.has("hostility"):
		_sync_player_faction_relation(faction_index)
	return applied

func _sync_player_faction_relation(faction_index: int) -> void:
	if faction_index < 0 or faction_index >= factions.size():
		return
	var player: Dictionary = _player_faction_identity()
	var target: Dictionary = _dict(factions[faction_index])
	var player_id: String = str(player.get("id", ""))
	var player_name: String = str(player.get("name", ""))
	var target_id: String = str(target.get("id", ""))
	var target_name: String = str(target.get("name", ""))
	if target_id.is_empty() or player_id == target_id or (not target_name.is_empty() and player_name == target_name):
		return
	var relation: int = int(_number(target.get("relation_to_player", 0)))
	var hostility: int = int(_number(target.get("hostility", 0)))
	var value: int = relation - hostility
	var relation_type: String = _faction_relation_type_from_scores(relation, hostility)
	var desc: String = "由势力态势同步：对明关系 %d，敌意 %d。" % [relation, hostility]
	for i in range(faction_relations.size()):
		var existing: Dictionary = _dict(faction_relations[i]).duplicate(true)
		var from_endpoint: String = str(existing.get("from", ""))
		var to_endpoint: String = str(existing.get("to", ""))
		var forward: bool = _relationship_endpoint_matches(from_endpoint, player_id, player_name) and _relationship_endpoint_matches(to_endpoint, target_id, target_name)
		var reverse: bool = _relationship_endpoint_matches(from_endpoint, target_id, target_name) and _relationship_endpoint_matches(to_endpoint, player_id, player_name)
		if not forward and not reverse:
			continue
		existing["value"] = value
		existing["type"] = relation_type
		existing["desc"] = desc
		if str(existing.get("from", "")).is_empty():
			existing["from"] = player_name
		if str(existing.get("to", "")).is_empty():
			existing["to"] = target_name
		faction_relations[i] = existing
		return
	faction_relations.append({
		"id": "dynamic_relation_%s_%s" % [player_id, target_id],
		"from": player_name,
		"to": target_name,
		"type": relation_type,
		"value": value,
		"desc": desc
	})

func _faction_relation_type_from_scores(relation: int, hostility: int) -> String:
	var value: int = relation - hostility
	if hostility >= 75 or value <= -60:
		return "war"
	if hostility >= 55 or value <= -30:
		return "hostile"
	if relation >= 65 and hostility <= 35:
		return "friendly"
	return "neutral"

func _apply_faction_region_transfer(faction_index: int, action: Dictionary) -> Dictionary:
	var mode: String = str(action.get("transfer_region", ""))
	if mode.is_empty():
		return {}
	if faction_index < 0 or faction_index >= factions.size():
		return {
			"ok": false,
			"error": "unknown target faction"
		}
	if mode != "to_player":
		return {
			"ok": false,
			"error": "unknown region transfer mode: %s" % mode
		}

	var target_faction: Dictionary = _dict(factions[faction_index])
	var region_index: int = _first_region_index_for_faction(target_faction)
	if region_index < 0:
		return {
			"ok": false,
			"error": "target faction has no transferable region"
		}

	var player: Dictionary = _player_faction_identity()
	var region: Dictionary = _dict(map_regions[region_index]).duplicate(true)
	var before_owner: String = str(region.get("owner", region.get("owner_id", "")))
	var before_controller: String = str(region.get("controller", region.get("controller_id", before_owner)))
	region["owner_id"] = str(player.get("id", "ming"))
	region["owner"] = str(player.get("name", "大明"))
	region["controller_id"] = str(player.get("id", "ming"))
	region["controller"] = str(player.get("name", "大明"))
	region["last_transfer_turn"] = turn
	region["last_transfer_reason"] = str(action.get("name", "申明封疆"))
	map_regions[region_index] = region

	_refresh_faction_territory_summary(faction_index)
	var player_index: int = _faction_index_by_identity(str(player.get("id", "")), str(player.get("name", "")))
	if player_index >= 0:
		_refresh_faction_territory_summary(player_index)

	return {
		"ok": true,
		"mode": mode,
		"region_id": str(region.get("id", "")),
		"region": str(region.get("name", "")),
		"before_owner": before_owner,
		"before_controller": before_controller,
		"after_owner": str(region.get("owner", "")),
		"after_controller": str(region.get("controller", "")),
		"target_faction_id": str(target_faction.get("id", "")),
		"target_faction": str(target_faction.get("name", ""))
	}

func _first_region_index_for_faction(faction: Dictionary) -> int:
	var best_index: int = -1
	var best_score: float = -999999.0
	for i in range(map_regions.size()):
		var region: Dictionary = _dict(map_regions[i])
		if _region_matches_faction(region, faction):
			var score: float = _region_transfer_priority(region)
			if score > best_score:
				best_score = score
				best_index = i
	return best_index

func _region_transfer_priority(region: Dictionary) -> float:
	return _number(region.get("unrest", 0)) + _number(region.get("army_pressure", 0)) + maxf(0.0, 50.0 - _number(region.get("mood", 50))) + maxf(0.0, 50.0 - _number(region.get("prosperity", 50))) * 0.25

func _region_matches_faction(region: Dictionary, faction: Dictionary) -> bool:
	var faction_id: String = str(faction.get("id", ""))
	var faction_name: String = str(faction.get("name", ""))
	for key in ["owner_id", "controller_id", "owner", "controller"]:
		var value: String = str(region.get(key, ""))
		if not faction_id.is_empty() and value == faction_id:
			return true
		if not faction_name.is_empty() and value == faction_name:
			return true
	return false

func _player_faction_identity() -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		var name: String = str(faction.get("name", ""))
		if name == "大明" or name.contains("明"):
			return {
				"id": str(faction.get("id", "ming")),
				"name": name
			}
	return {
		"id": "ming",
		"name": "大明"
	}

func _faction_index_by_identity(id: String, name: String) -> int:
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i])
		if (not id.is_empty() and str(faction.get("id", "")) == id) or (not name.is_empty() and str(faction.get("name", "")) == name):
			return i
	return -1

func _refresh_faction_territory_summary(faction_index: int) -> void:
	if faction_index < 0 or faction_index >= factions.size():
		return
	var faction: Dictionary = _dict(factions[faction_index]).duplicate(true)
	var names: PackedStringArray = PackedStringArray()
	for raw in map_regions:
		var region: Dictionary = _dict(raw)
		if _region_matches_faction(region, faction):
			names.append(_region_display_name(region))
	faction["territory_count"] = names.size()
	if names.is_empty():
		faction["territory"] = "无运行地块"
	else:
		faction["territory"] = "%d处：%s" % [names.size(), "、".join(names)]
	factions[faction_index] = faction

func _statecraft_action_by_id(action_id: String) -> Dictionary:
	for raw in _default_statecraft_actions():
		var action: Dictionary = _dict(raw)
		if str(action.get("id", "")) == action_id:
			return action
	return {}

func _apply_variable_effects(effects: Dictionary) -> Dictionary:
	var applied: Dictionary = {}
	var keys: Array = effects.keys()
	keys.sort()
	for key in keys:
		var variable_name: String = str(key)
		if not variable_values.has(variable_name):
			continue
		var delta: float = _number(effects[key])
		var before: float = variable_value(variable_name)
		var after: float = _clamp_variable_value(variable_name, before + delta)
		set_variable_value(variable_name, after)
		applied[variable_name] = after - before
	return applied

func _clamp_variable_value(variable_name: String, value: float) -> float:
	for raw in variables:
		var row: Dictionary = _dict(raw)
		if str(row.get("name", "")) != variable_name:
			continue
		if row.has("min"):
			value = maxf(value, _number(row.get("min", value)))
		var min_value: float = _number(row.get("min", 0))
		var max_value: float = _number(row.get("max", 0))
		if row.has("max") and max_value > min_value:
			value = minf(value, max_value)
		return value
	return value

func _statecraft_outcome(variable_name: String, before_value: float, after_value: float, _action: Dictionary) -> String:
	var delta: float = after_value - before_value
	if is_equal_approx(delta, 0.0):
		return "%s暂未明显变化。" % variable_name
	if delta > 0.0:
		return "%s上升%s。" % [variable_name, _signed_big(delta, "")]
	return "%s下降%s。" % [variable_name, _signed_big(delta, "")]

func _statecraft_description(variable_name: String, before_value: float, after_value: float, action: Dictionary, variable_applied: Dictionary) -> String:
	var lines: PackedStringArray = PackedStringArray()
	lines.append("%s：%s" % [str(action.get("name", "")), str(action.get("desc", ""))])
	lines.append("%s %s→%s" % [variable_name, fmt_big(before_value, ""), fmt_big(after_value, "")])
	for key in variable_applied.keys():
		if str(key) == variable_name:
			continue
		lines.append("%s %s" % [str(key), _signed_big(_number(variable_applied.get(key, 0)), "")])
	return "\n".join(lines)

func _variable_status_text(row: Dictionary, value: float) -> String:
	var min_value: float = _number(row.get("min", 0))
	var max_value: float = _number(row.get("max", 0))
	if max_value > min_value:
		var ratio: float = clampf((value - min_value) / maxf(1.0, max_value - min_value), 0.0, 1.0)
		if ratio >= 0.75:
			return "偏高"
		if ratio <= 0.25:
			return "偏低"
	return "平"

func _faction_attitude_from_scores(relation: int, hostility: int) -> String:
	if hostility >= 75:
		return "敌对"
	if relation >= 65 and hostility <= 35:
		return "亲善"
	if relation >= 45 and hostility <= 55:
		return "观望"
	return "疏离"

func hold_court_meeting(topic_id: String, participant_ids: Array = []) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var topic: Dictionary = _court_meeting_topic_by_id(topic_id)
	if topic.is_empty():
		return {
			"ok": false,
			"error": "unknown court meeting topic: %s" % topic_id
		}
	var cost: int = max(1, int(_number(topic.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var participants: Array = _meeting_participants(participant_ids)
	if participants.is_empty():
		return {
			"ok": false,
			"error": "no valid meeting participants"
		}

	var agenda_pressure: Array = _meeting_agenda_pressure(topic)
	var score: float = clampf(_meeting_score(topic, participants) + _agenda_score_bonus(agenda_pressure), 0.0, 100.0)
	var debate_entries: Array = _meeting_debate_entries(topic, participants, agenda_pressure)
	var applied: Dictionary = _apply_effects(_dict(topic.get("effects", {})))
	var resolution_applied: Dictionary = {}
	var recommendations: Array = []
	var threshold: float = _number(topic.get("threshold", 60))
	var outcome: String = "议而未决"
	if score >= threshold:
		resolution_applied = _apply_effects(_dict(topic.get("success_effects", {})))
		recommendations = _create_court_recommendations(topic, participants, score, agenda_pressure)
		outcome = "决议成行"
	action_points -= cost

	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": topic_id,
		"name": str(topic.get("name", topic_id)),
		"domain": str(topic.get("domain", "")),
		"cost": cost,
		"score": score,
		"threshold": threshold,
		"outcome": outcome,
		"agenda_pressure": agenda_pressure,
		"participants": _participant_names(participants),
		"debate_entries": debate_entries,
		"recommendations": recommendations,
		"applied": applied,
		"resolution_applied": resolution_applied
	}
	court_meeting_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"topic": topic,
		"record": record,
		"score": score,
		"outcome": outcome,
		"agenda_pressure": agenda_pressure,
		"participants": participants,
		"debate_entries": debate_entries,
		"recommendations": recommendations,
		"applied": applied,
		"resolution_applied": resolution_applied
	}

func _court_meeting_topic_by_id(topic_id: String) -> Dictionary:
	for raw in court_meeting_topics:
		var topic: Dictionary = _dict(raw)
		if str(topic.get("id", "")) == topic_id:
			return topic
	return {}

func _meeting_participants(participant_ids: Array) -> Array:
	var rows: Array = []
	var seen: Dictionary = {}
	for raw_id in participant_ids:
		var id: String = str(raw_id)
		if id.is_empty() or seen.has(id):
			continue
		var character: Dictionary = character_by_id(id)
		if character.is_empty():
			continue
		seen[id] = true
		rows.append(character)
		if rows.size() >= 6:
			break
	return rows

func _meeting_score(topic: Dictionary, participants: Array) -> float:
	var total: float = 0.0
	var domain: String = str(topic.get("domain", "court"))
	for raw in participants:
		total += _meeting_character_score(_dict(raw), domain)
	return clampf(total / maxf(1.0, float(participants.size())), 0.0, 100.0)

func _meeting_agenda_pressure(topic: Dictionary) -> Array:
	var domain: String = str(topic.get("domain", "court"))
	match domain:
		"frontier":
			return _frontier_agenda_pressure()
		"relief":
			return _relief_agenda_pressure()
		"finance":
			return _finance_agenda_pressure()
		_:
			return []

func _frontier_agenda_pressure() -> Array:
	var rows: Array = []
	for raw in map_regions:
		var region: Dictionary = _dict(raw)
		var army_pressure: float = _number(region.get("army_pressure", 0))
		var unrest: float = _number(region.get("unrest", 0))
		var severity: float = army_pressure * 0.72 + unrest * 0.28
		if army_pressure < 70.0 and not (army_pressure >= 55.0 and unrest >= 55.0):
			continue
		rows.append({
			"kind": "frontier_region",
			"domain": "frontier",
			"target_region_id": _region_runtime_id(region),
			"target_region": _region_display_name(region),
			"severity": severity,
			"score_bonus": clampf((severity - 60.0) * 0.12, 0.0, 5.0),
			"summary": "%s army pressure %.0f, unrest %.0f" % [_region_display_name(region), army_pressure, unrest]
		})
	rows.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return _number(a.get("severity", 0)) > _number(b.get("severity", 0))
	)
	return rows

func _relief_agenda_pressure() -> Array:
	var rows: Array = []
	for raw in map_regions:
		var region: Dictionary = _dict(raw)
		var unrest: float = _number(region.get("unrest", 0))
		var mood: float = _number(region.get("mood", 50))
		var severity: float = unrest * 0.70 + maxf(0.0, 50.0 - mood) * 0.60
		if unrest < 70.0 and mood > 30.0:
			continue
		rows.append({
			"kind": "relief_region",
			"domain": "relief",
			"target_region_id": _region_runtime_id(region),
			"target_region": _region_display_name(region),
			"severity": severity,
			"score_bonus": clampf((severity - 55.0) * 0.10, 0.0, 4.0),
			"summary": "%s unrest %.0f, mood %.0f" % [_region_display_name(region), unrest, mood]
		})
	rows.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return _number(a.get("severity", 0)) > _number(b.get("severity", 0))
	)
	return rows

func _finance_agenda_pressure() -> Array:
	var rows: Array = []
	if guoku_money < 500000.0:
		rows.append({
			"kind": "finance_stress",
			"domain": "finance",
			"severity": clampf((500000.0 - guoku_money) / 5000.0, 0.0, 100.0),
			"score_bonus": 3.0,
			"summary": "Treasury reserve is below the emergency threshold"
		})
	return rows

func _agenda_score_bonus(agenda_pressure: Array) -> float:
	var bonus: float = 0.0
	for raw in agenda_pressure:
		bonus += _number(_dict(raw).get("score_bonus", 0))
	return clampf(bonus, 0.0, 8.0)

func _meeting_character_score(character: Dictionary, domain: String) -> float:
	var intelligence: float = _number(character.get("intelligence", 0))
	var administration: float = _number(character.get("administration", 0))
	var management: float = _number(character.get("management", administration))
	var military: float = _number(character.get("military", 0))
	var valor: float = _number(character.get("valor", 0))
	var loyalty: float = _number(character.get("loyalty", 50))
	match domain:
		"finance":
			return administration * 0.50 + management * 0.20 + intelligence * 0.20 + loyalty * 0.10
		"frontier":
			return military * 0.45 + valor * 0.20 + intelligence * 0.20 + loyalty * 0.15
		"relief":
			return administration * 0.35 + intelligence * 0.25 + management * 0.20 + loyalty * 0.20
		_:
			return intelligence * 0.40 + administration * 0.30 + loyalty * 0.30

func _participant_names(participants: Array) -> Array:
	var names: Array = []
	for raw in participants:
		var character: Dictionary = _dict(raw)
		names.append(str(character.get("name", "")))
	return names

func _meeting_debate_entries(topic: Dictionary, participants: Array, agenda_pressure: Array = []) -> Array:
	var entries: Array = []
	var domain: String = str(topic.get("domain", "court"))
	var topic_name: String = str(topic.get("name", topic.get("id", "meeting")))
	var agenda_note: String = _agenda_speech_note(agenda_pressure)
	for raw in participants:
		var character: Dictionary = _dict(raw)
		var relationship_context: Dictionary = _meeting_relationship_context(character, participants)
		var stance: String = _meeting_stance(character, relationship_context)
		var entry: Dictionary = {
			"character_id": str(character.get("id", "")),
			"name": str(character.get("name", "")),
			"party": str(character.get("party", "")),
			"faction": str(character.get("faction", "")),
			"stance": stance,
			"domain": domain,
			"agenda_note": agenda_note,
			"relationship_context": relationship_context,
			"weight": _meeting_character_score(character, domain),
			"speech": _meeting_speech(character, topic_name, stance, agenda_note, relationship_context)
		}
		entries.append(entry)
	return entries

func _meeting_stance(character: Dictionary, relationship_context: Dictionary = {}) -> String:
	var relationship_kind: String = str(relationship_context.get("kind", ""))
	if relationship_kind == "rival":
		return "oppose"
	if relationship_kind == "ally":
		return "support"
	var loyalty: float = _number(character.get("loyalty", 50))
	var ambition: float = _number(character.get("ambition", 50))
	if ambition >= 85.0 or loyalty <= 45.0:
		return "oppose"
	if ambition >= 65.0 or loyalty <= 60.0:
		return "caution"
	return "support"

func _meeting_relationship_context(character: Dictionary, participants: Array) -> Dictionary:
	var character_id: String = str(character.get("id", ""))
	var best_rival: Dictionary = {}
	var best_ally: Dictionary = {}
	for raw_target in participants:
		var target: Dictionary = _dict(raw_target)
		var target_id: String = str(target.get("id", ""))
		if target_id.is_empty() or target_id == character_id:
			continue
		var value: float = _relationship_value(character, target)
		if value <= -60.0 and (best_rival.is_empty() or value < _number(best_rival.get("value", 0))):
			best_rival = {
				"kind": "rival",
				"target_id": target_id,
				"target_name": str(target.get("name", target_id)),
				"value": value
			}
		if value >= 60.0 and (best_ally.is_empty() or value > _number(best_ally.get("value", 0))):
			best_ally = {
				"kind": "ally",
				"target_id": target_id,
				"target_name": str(target.get("name", target_id)),
				"value": value
			}
	if not best_rival.is_empty():
		return best_rival
	return best_ally

func _relationship_value(character: Dictionary, target: Dictionary) -> float:
	var target_id: String = str(target.get("id", ""))
	var target_name: String = str(target.get("name", ""))
	for key in ["relationships", "relations", "relationship"]:
		if not character.has(key):
			continue
		var raw: Variant = character.get(key)
		if typeof(raw) == TYPE_DICTIONARY:
			var rows: Dictionary = _dict(raw)
			if rows.has(target_id):
				return _relationship_entry_value(rows[target_id])
			if not target_name.is_empty() and rows.has(target_name):
				return _relationship_entry_value(rows[target_name])
		elif typeof(raw) == TYPE_ARRAY:
			for raw_row in _array(raw):
				var row: Dictionary = _dict(raw_row)
				var row_target: String = str(row.get("target_id", row.get("target", row.get("name", ""))))
				if row_target == target_id or (not target_name.is_empty() and row_target == target_name):
					return _relationship_entry_value(row)
	var table_result: Dictionary = _top_level_relationship_value(character, target)
	if bool(table_result.get("found", false)):
		return _number(table_result.get("value", 0))
	return 0.0

func _top_level_relationship_value(character: Dictionary, target: Dictionary) -> Dictionary:
	var character_id: String = str(character.get("id", ""))
	var character_name: String = str(character.get("name", ""))
	var target_id: String = str(target.get("id", ""))
	var target_name: String = str(target.get("name", ""))
	var reverse_match: Dictionary = {}
	for raw in character_relations:
		var relation: Dictionary = _dict(raw)
		var from_endpoint: String = str(relation.get("from", ""))
		var to_endpoint: String = str(relation.get("to", ""))
		if _relationship_endpoint_matches(from_endpoint, character_id, character_name) and _relationship_endpoint_matches(to_endpoint, target_id, target_name):
			return {
				"found": true,
				"value": _relationship_entry_value(relation),
				"relation": relation
			}
		if reverse_match.is_empty() and _relationship_endpoint_matches(from_endpoint, target_id, target_name) and _relationship_endpoint_matches(to_endpoint, character_id, character_name):
			reverse_match = {
				"found": true,
				"value": _relationship_entry_value(relation),
				"relation": relation
			}
	if not reverse_match.is_empty():
		return reverse_match
	return {
		"found": false,
		"value": 0
	}

func _relationship_endpoint_matches(endpoint: String, id: String, display_name: String) -> bool:
	if endpoint.is_empty():
		return false
	if not id.is_empty() and endpoint == id:
		return true
	if not display_name.is_empty() and endpoint == display_name:
		return true
	return false

func _relationship_entry_value(value: Variant) -> float:
	if typeof(value) == TYPE_DICTIONARY:
		var row: Dictionary = _dict(value)
		return _number(row.get("value", row.get("score", row.get("opinion", 0))))
	return _number(value)

func _meeting_speech(character: Dictionary, topic_name: String, stance: String, agenda_note: String = "", relationship_context: Dictionary = {}) -> String:
	var name: String = str(character.get("name", "official"))
	var focus: String = " around %s" % agenda_note if not agenda_note.is_empty() else ""
	var relationship_clause: String = _relationship_speech_clause(relationship_context)
	match stance:
		"support":
			return "%s supports %s%s%s and urges a clear decree." % [name, topic_name, focus, relationship_clause]
		"oppose":
			return "%s opposes %s%s%s and warns of court resistance." % [name, topic_name, focus, relationship_clause]
		_:
			return "%s advises caution on %s%s%s before action." % [name, topic_name, focus, relationship_clause]

func _relationship_speech_clause(relationship_context: Dictionary) -> String:
	if relationship_context.is_empty():
		return ""
	var target_name: String = str(relationship_context.get("target_name", ""))
	if target_name.is_empty():
		return ""
	match str(relationship_context.get("kind", "")):
		"rival":
			return " against rival %s" % target_name
		"ally":
			return " alongside ally %s" % target_name
	return ""

func _agenda_speech_note(agenda_pressure: Array) -> String:
	if agenda_pressure.is_empty():
		return ""
	var pressure: Dictionary = _dict(agenda_pressure[0])
	var target_region: String = str(pressure.get("target_region", ""))
	if not target_region.is_empty():
		return target_region
	return str(pressure.get("summary", ""))

func _create_court_recommendations(topic: Dictionary, participants: Array, score: float, agenda_pressure: Array = []) -> Array:
	var created: Array = []
	var raw_recommendations: Array = _array(topic.get("recommendations", []))
	var topic_id: String = str(topic.get("id", "topic"))
	var participant_names: Array = _participant_names(participants)
	for i in range(raw_recommendations.size()):
		var source: Dictionary = _dict(raw_recommendations[i])
		if source.is_empty():
			continue
		var recommendation: Dictionary = source.duplicate(true)
		recommendation["id"] = "meeting-%d-%s-%d" % [turn, topic_id, pending_court_recommendations.size() + created.size()]
		recommendation["turn"] = turn
		recommendation["year"] = year
		recommendation["month"] = month
		recommendation["source_topic_id"] = topic_id
		recommendation["source_topic"] = str(topic.get("name", topic_id))
		recommendation["score"] = score
		recommendation["participants"] = participant_names.duplicate(true)
		recommendation["cost"] = max(1, int(_number(recommendation.get("cost", 1))))
		recommendation["step"] = max(1, int(_number(recommendation.get("step", 1))))
		pending_court_recommendations.append(recommendation)
		created.append(recommendation)
	created.append_array(_create_agenda_recommendations(topic, participants, score, agenda_pressure))
	return created

func _create_agenda_recommendations(topic: Dictionary, participants: Array, score: float, agenda_pressure: Array) -> Array:
	var created: Array = []
	var topic_id: String = str(topic.get("id", "topic"))
	var participant_names: Array = _participant_names(participants)
	for raw in agenda_pressure:
		var pressure: Dictionary = _dict(raw)
		var recommendation: Dictionary = _agenda_recommendation(topic_id, topic, pressure)
		if recommendation.is_empty():
			continue
		recommendation["id"] = "agenda-%d-%s-%d" % [turn, topic_id, pending_court_recommendations.size() + created.size()]
		recommendation["turn"] = turn
		recommendation["year"] = year
		recommendation["month"] = month
		recommendation["source_topic_id"] = topic_id
		recommendation["source_topic"] = str(topic.get("name", topic_id))
		recommendation["score"] = score
		recommendation["participants"] = participant_names.duplicate(true)
		recommendation["agenda_pressure"] = pressure.duplicate(true)
		recommendation["cost"] = max(1, int(_number(recommendation.get("cost", 1))))
		recommendation["step"] = max(1, int(_number(recommendation.get("step", 1))))
		pending_court_recommendations.append(recommendation)
		created.append(recommendation)
	return created

func _agenda_recommendation(_topic_id: String, _topic: Dictionary, pressure: Dictionary) -> Dictionary:
	var kind: String = str(pressure.get("kind", ""))
	var target_region_id: String = str(pressure.get("target_region_id", ""))
	var target_region: String = str(pressure.get("target_region", target_region_id))
	match kind:
		"frontier_region":
			if target_region_id.is_empty():
				return {}
			return {
				"decision_key": "stabilize_%s" % target_region_id,
				"name": "整饬%s防务" % target_region,
				"category": "军务",
				"cost": 1,
				"desc": "按会议急务调拨军饷、兵械和营伍，先压低该地军务压力。",
				"target_region_id": target_region_id,
				"target_region": target_region,
				"effects": {
					"treasury_money": -100000,
					"huangwei": 1
				},
				"region_effects": {
					target_region_id: {
						"army_pressure": -10,
						"unrest": -4,
						"troops": 3000
					}
				}
			}
		"relief_region":
			if target_region_id.is_empty():
				return {}
			return {
				"decision_key": "relief_%s" % target_region_id,
				"name": "赈抚%s" % target_region,
				"category": "民生",
				"cost": 1,
				"desc": "按会议急务发粮赈济并安抚地方，先压低民变风险。",
				"target_region_id": target_region_id,
				"target_region": target_region,
				"effects": {
					"treasury_grain": -80000,
					"minxin": 1
				},
				"region_effects": {
					target_region_id: {
						"mood": 6,
						"unrest": -8
					}
				}
			}
		"finance_stress":
			return {
				"decision_key": "emergency_fiscal_audit",
				"name": "急核库藏",
				"category": "财政",
				"cost": 1,
				"desc": "按会议急务清点库藏、封存浮支，为下月调度留出余地。",
				"effects": {
					"treasury_money": 90000,
					"huangquan": 1
				}
			}
	return {}

func _region_runtime_id(region: Dictionary) -> String:
	var id: String = str(region.get("id", ""))
	if not id.is_empty():
		return id
	return str(region.get("name", ""))

func _region_display_name(region: Dictionary) -> String:
	var name: String = str(region.get("name", ""))
	if not name.is_empty():
		return name
	return _region_runtime_id(region)

func enact_court_recommendation(recommendation_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var index: int = _court_recommendation_index(recommendation_id)
	if index < 0:
		return {
			"ok": false,
			"error": "unknown court recommendation: %s" % recommendation_id
		}
	var recommendation: Dictionary = _dict(pending_court_recommendations[index]).duplicate(true)
	var cost: int = max(1, int(_number(recommendation.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}
	var recommendation_effects: Dictionary = _dict(recommendation.get("effects", {})).duplicate(true)
	if recommendation.has("region_effects"):
		recommendation_effects["region_effects"] = recommendation.get("region_effects")
	if recommendation.has("faction_effects"):
		recommendation_effects["faction_effects"] = recommendation.get("faction_effects")
	var applied: Dictionary = _apply_event_effects(recommendation_effects)
	action_points -= cost
	recommendation["enacted_turn"] = turn
	recommendation["applied"] = applied
	pending_court_recommendations.remove_at(index)
	var discarded: Array = _discard_conflicting_recommendations(recommendation)
	var followups: Array = _create_recommendation_followups(recommendation)
	enacted_court_recommendations.append(recommendation)
	emit_signal("state_changed")
	return {
		"ok": true,
		"recommendation": recommendation,
		"applied": applied,
		"discarded": discarded,
		"followups": followups
	}

func _court_recommendation_index(recommendation_id: String) -> int:
	for i in range(pending_court_recommendations.size()):
		var recommendation: Dictionary = _dict(pending_court_recommendations[i])
		if str(recommendation.get("id", "")) == recommendation_id:
			return i
	return -1

func _discard_conflicting_recommendations(enacted: Dictionary) -> Array:
	var group: String = str(enacted.get("exclusive_group", ""))
	if group.is_empty():
		return []
	var discarded: Array = []
	var i: int = pending_court_recommendations.size() - 1
	while i >= 0:
		var recommendation: Dictionary = _dict(pending_court_recommendations[i]).duplicate(true)
		if str(recommendation.get("exclusive_group", "")) == group:
			recommendation["discarded_turn"] = turn
			recommendation["discarded_by_recommendation_id"] = str(enacted.get("id", ""))
			recommendation["discard_reason"] = "exclusive recommendation enacted"
			discarded.append(recommendation)
			discarded_court_recommendations.append(recommendation)
			pending_court_recommendations.remove_at(i)
		i -= 1
	discarded.reverse()
	return discarded

func _create_recommendation_followups(enacted: Dictionary) -> Array:
	var created: Array = []
	var followups: Array = _array(enacted.get("followups", []))
	var source_id: String = str(enacted.get("id", ""))
	var source_topic_id: String = str(enacted.get("source_topic_id", ""))
	var source_step: int = max(1, int(_number(enacted.get("step", 1))))
	for raw in followups:
		var source: Dictionary = _dict(raw)
		if source.is_empty():
			continue
		var recommendation: Dictionary = source.duplicate(true)
		recommendation["id"] = "followup-%d-%s-%d" % [turn, str(enacted.get("decision_key", "decision")), pending_court_recommendations.size() + created.size()]
		recommendation["turn"] = turn
		recommendation["year"] = year
		recommendation["month"] = month
		recommendation["source_recommendation_id"] = source_id
		recommendation["source_recommendation"] = str(enacted.get("name", ""))
		recommendation["source_topic_id"] = source_topic_id
		recommendation["source_topic"] = str(enacted.get("source_topic", ""))
		recommendation["step"] = max(source_step + 1, int(_number(recommendation.get("step", source_step + 1))))
		recommendation["cost"] = max(1, int(_number(recommendation.get("cost", 1))))
		pending_court_recommendations.append(recommendation)
		created.append(recommendation)
	return created

func perform_player_action(action_id: String) -> Dictionary:
	if action_points <= 0:
		return {
			"ok": false,
			"error": "no action points"
		}
	var action: Dictionary = _action_by_id(action_id)
	if action.is_empty():
		return {
			"ok": false,
			"error": "unknown action: %s" % action_id
		}
	var cost: int = max(1, int(_number(action.get("cost", 1))))
	if action_points < cost:
		return {
			"ok": false,
			"error": "not enough action points"
		}

	var applied: Dictionary = _apply_effects(_dict(action.get("effects", {})))
	action_points -= cost
	var record: Dictionary = {
		"turn": turn,
		"year": year,
		"month": month,
		"id": action_id,
		"name": str(action.get("name", action_id)),
		"cost": cost,
		"applied": applied
	}
	action_history.append(record)
	emit_signal("state_changed")
	return {
		"ok": true,
		"action": action,
		"record": record,
		"applied": applied
	}

func _action_by_id(action_id: String) -> Dictionary:
	for raw in player_actions:
		var action: Dictionary = _dict(raw)
		if str(action.get("id", "")) == action_id:
			return action
	return {}

func resolve_event(event_id: String, choice_index: int = -1) -> Dictionary:
	var queue_index: int = _event_queue_index(event_id)
	if queue_index < 0:
		return {
			"ok": false,
			"error": "event not in queue: %s" % event_id
		}

	var event: Dictionary = _dict(event_queue[queue_index]).duplicate(true)
	var choices: Array = _array(event.get("choices", []))
	var choice: Dictionary = {}
	var effects: Dictionary = {}
	if choices.size() > 0:
		var selected_index: int = choice_index if choice_index >= 0 else 0
		if selected_index < 0 or selected_index >= choices.size():
			return {
				"ok": false,
				"error": "choice index out of range"
			}
		choice = _dict(choices[selected_index]).duplicate(true)
		effects = _dict(choice.get("effect_data", {}))
	else:
		effects = _dict(event.get("effect_data", {}))

	var applied: Dictionary = _apply_event_effects(effects)
	event["resolved_turn"] = turn
	event["choice_index"] = choice_index
	event["choice_text"] = str(choice.get("text", ""))
	event["applied_effects"] = applied
	resolved_events.append(event)
	event_queue.remove_at(queue_index)
	emit_signal("state_changed")
	return {
		"ok": true,
		"event": event,
		"choice": choice,
		"applied": applied
	}

func _event_queue_index(event_id: String) -> int:
	for i in range(event_queue.size()):
		var event: Dictionary = _dict(event_queue[i])
		if str(event.get("id", "")) == event_id:
			return i
	return -1

func _apply_event_effects(effects: Dictionary) -> Dictionary:
	var direct_effects: Dictionary = effects.duplicate(true)
	var region_scope: Variant = null
	var faction_scope: Variant = null
	if direct_effects.has("region_effects"):
		region_scope = direct_effects.get("region_effects")
		direct_effects.erase("region_effects")
	if direct_effects.has("regions"):
		region_scope = direct_effects.get("regions")
		direct_effects.erase("regions")
	if direct_effects.has("faction_effects"):
		faction_scope = direct_effects.get("faction_effects")
		direct_effects.erase("faction_effects")
	if direct_effects.has("factions"):
		faction_scope = direct_effects.get("factions")
		direct_effects.erase("factions")

	var applied: Dictionary = _apply_effects(direct_effects)
	var region_applied: Array = _apply_event_region_effects(region_scope)
	var faction_applied: Array = _apply_event_faction_effects(faction_scope)
	if not region_applied.is_empty():
		applied["region_effects"] = region_applied
	if not faction_applied.is_empty():
		applied["faction_effects"] = faction_applied
	return applied

func _apply_event_region_effects(scope: Variant) -> Array:
	var applied_rows: Array = []
	if typeof(scope) == TYPE_DICTIONARY:
		var scope_dict: Dictionary = _dict(scope)
		if scope_dict.has("effects"):
			var target: String = str(scope_dict.get("target_region_id", scope_dict.get("target", scope_dict.get("name", ""))))
			var target_index: int = _region_index_by_id(target)
			var applied: Dictionary = _apply_region_effects(target_index, _dict(scope_dict.get("effects", {})))
			if not applied.is_empty():
				applied_rows.append({"target": target, "applied": applied})
			return applied_rows
		var keys: Array = scope_dict.keys()
		keys.sort()
		for raw_key in keys:
			var target_key: String = str(raw_key)
			var target_index: int = _region_index_by_id(target_key)
			var applied: Dictionary = _apply_region_effects(target_index, _dict(scope_dict[raw_key]))
			if not applied.is_empty():
				applied_rows.append({"target": target_key, "applied": applied})
	elif typeof(scope) == TYPE_ARRAY:
		for raw_row in _array(scope):
			var row: Dictionary = _dict(raw_row)
			var target: String = str(row.get("target_region_id", row.get("target", row.get("name", ""))))
			var target_index: int = _region_index_by_id(target)
			var applied: Dictionary = _apply_region_effects(target_index, _dict(row.get("effects", {})))
			if not applied.is_empty():
				applied_rows.append({"target": target, "applied": applied})
	return applied_rows

func _apply_event_faction_effects(scope: Variant) -> Array:
	var applied_rows: Array = []
	if typeof(scope) == TYPE_DICTIONARY:
		var scope_dict: Dictionary = _dict(scope)
		if scope_dict.has("effects"):
			var target: String = str(scope_dict.get("target_faction_id", scope_dict.get("target", scope_dict.get("name", ""))))
			var target_index: int = _faction_index_by_id(target)
			var applied: Dictionary = _apply_faction_effects(target_index, _dict(scope_dict.get("effects", {})))
			if not applied.is_empty():
				applied_rows.append({"target": target, "applied": applied})
			return applied_rows
		var keys: Array = scope_dict.keys()
		keys.sort()
		for raw_key in keys:
			var target_key: String = str(raw_key)
			var target_index: int = _faction_index_by_id(target_key)
			var applied: Dictionary = _apply_faction_effects(target_index, _dict(scope_dict[raw_key]))
			if not applied.is_empty():
				applied_rows.append({"target": target_key, "applied": applied})
	elif typeof(scope) == TYPE_ARRAY:
		for raw_row in _array(scope):
			var row: Dictionary = _dict(raw_row)
			var target: String = str(row.get("target_faction_id", row.get("target", row.get("name", ""))))
			var target_index: int = _faction_index_by_id(target)
			var applied: Dictionary = _apply_faction_effects(target_index, _dict(row.get("effects", {})))
			if not applied.is_empty():
				applied_rows.append({"target": target, "applied": applied})
	return applied_rows

func _apply_effects(effects: Dictionary) -> Dictionary:
	var applied: Dictionary = {}
	var keys: Array = effects.keys()
	keys.sort()
	for key in keys:
		var effect_name: String = str(key)
		var delta: float = _number(effects[key])
		match effect_name:
			"huangquan", "imperial_authority":
				huangquan = clampf(huangquan + delta, 0.0, 100.0)
				applied[effect_name] = delta
			"huangwei", "imperial_prestige":
				huangwei = clampf(huangwei + delta, 0.0, 100.0)
				applied[effect_name] = delta
			"minxin", "public_morale":
				minxin = clampf(minxin + delta, 0.0, 100.0)
				applied[effect_name] = delta
			"treasury_money":
				guoku_money = maxf(0.0, guoku_money + delta)
				applied[effect_name] = delta
			"inner_treasury_money":
				neitang_money = maxf(0.0, neitang_money + delta)
				applied[effect_name] = delta
			"treasury_grain":
				guoku_grain = maxf(0.0, guoku_grain + delta)
				applied[effect_name] = delta
			"population_registered":
				population_registered = maxf(0.0, population_registered + delta)
				applied[effect_name] = delta
			"population_hidden":
				population_hidden = maxf(0.0, population_hidden + delta)
				applied[effect_name] = delta
			"皇权":
				huangquan = clampf(huangquan + delta, 0.0, 100.0)
				applied[effect_name] = delta
			"皇威":
				huangwei = clampf(huangwei + delta, 0.0, 100.0)
				applied[effect_name] = delta
			"民心":
				minxin = clampf(minxin + delta, 0.0, 100.0)
				applied[effect_name] = delta
			"帑廪", "国库", "国库银":
				guoku_money = maxf(0.0, guoku_money + delta)
				applied[effect_name] = delta
			"内帑":
				neitang_money = maxf(0.0, neitang_money + delta)
				applied[effect_name] = delta
			"国库粮":
				guoku_grain = maxf(0.0, guoku_grain + delta)
				applied[effect_name] = delta
			_:
				set_variable_value(effect_name, variable_value(effect_name) + delta)
				applied[effect_name] = delta
	return applied

static func _default_statecraft_actions() -> Array:
	return [
		{
			"id": "open_remonstrance",
			"name": "疏通言路",
			"category": "政治",
			"target_variable": "言路通塞",
			"cost": 1,
			"desc": "准科道言官条陈时弊，压下堵塞言路的内外阻力。",
			"effects": {
				"treasury_money": -30000,
				"huangquan": 1,
				"huangwei": -1
			},
			"variable_effects": {
				"言路通塞": 6
			}
		},
		{
			"id": "curb_eunuch_power",
			"name": "裁抑阉权",
			"category": "权柄",
			"target_variable": "阉党权势值",
			"cost": 1,
			"desc": "收回内廷外差与厂卫越权，使朝纲稍归中枢。",
			"effects": {
				"huangquan": 2,
				"huangwei": -1
			},
			"variable_effects": {
				"阉党权势值": -5
			}
		},
		{
			"id": "relieve_refugee_pressure",
			"name": "安辑流民",
			"category": "民生",
			"target_variable": "流民数量",
			"cost": 1,
			"desc": "拨银设粥厂、给牛种、编保甲，压低流民压力。",
			"effects": {
				"treasury_money": -180000,
				"minxin": 2
			},
			"variable_effects": {
				"流民数量": -60000
			}
		},
		{
			"id": "pay_frontier_arrears",
			"name": "补发边饷",
			"category": "军务",
			"target_variable": "辽饷积欠",
			"cost": 1,
			"desc": "从国库拨银补发辽镇欠饷，稳住边军。",
			"effects": {
				"treasury_money": -300000,
				"huangwei": 2
			},
			"variable_effects": {
				"辽饷积欠": -30
			}
		}
	]

static func _default_player_actions() -> Array:
	return [
		{
			"id": "open_neitang_liaoxiang",
			"name": "开内帑济辽饷",
			"category": "军务",
			"cost": 1,
			"desc": "发内帑五十万两入国库，先补辽饷，稳住边镇。",
			"effects": {
				"内帑": -500000,
				"帑廪": 500000,
				"辽饷积欠": -50,
				"皇威": 2
			}
		},
		{
			"id": "relief_refugees",
			"name": "发帑赈济流民",
			"category": "民生",
			"cost": 1,
			"desc": "拨银二十万两赈济流民，略抬民心。",
			"effects": {
				"帑廪": -200000,
				"流民数量": -100000,
				"民心": 3
			}
		},
		{
			"id": "rebuke_yandang",
			"name": "申饬阉党",
			"category": "朝政",
			"cost": 1,
			"desc": "下旨申饬内廷爪牙，收束阉党气焰，但会激化党争。",
			"effects": {
				"阉党权势值": -5,
				"党争烈度": 2,
				"皇权": 1,
				"皇威": 1
			}
		},
		{
			"id": "repair_liaodong_frontier",
			"name": "整饬辽东防线",
			"category": "军务",
			"cost": 1,
			"desc": "拨款修城、补器械、稽核虚冒，提升辽东防线稳固度。",
			"effects": {
				"帑廪": -300000,
				"辽东防线稳固度": 5,
				"九边欠饷总数": -20
			}
		}
	]

static func _default_character_actions() -> Array:
	return [
		{
			"id": "reward",
			"name": "恩赏",
			"category": "笼络",
			"cost": 1,
			"neitang_money_cost": 10000,
			"description": "以内帑赐银、赐宴或温旨慰劳，稳住臣心。",
			"character_effects": {
				"loyalty": 6,
				"ambition": 1
			}
		},
		{
			"id": "admonish",
			"name": "申饬",
			"category": "约束",
			"cost": 1,
			"description": "降旨切责，使其收敛锋芒，但臣心会受挫。",
			"character_effects": {
				"loyalty": -2,
				"ambition": -5,
				"integrity": 1
			}
		},
		{
			"id": "inspect",
			"name": "考察",
			"category": "考课",
			"cost": 1,
			"description": "交都察院与吏部核其政声履历，略振考课。",
			"character_effects": {
				"loyalty": 1,
				"ambition": -1,
				"integrity": 2
			},
			"variable_effects": {
				"吏治": 2
			}
		}
	]

static func _default_audience_topics() -> Array:
	return [
		{
			"id": "frontier_policy",
			"name": "边务方略",
			"domain": "军务",
			"ability": "military",
			"cost": 1,
			"desc": "询问辽东、九边、军饷与将领节制。",
			"effects": {
				"皇威": 1,
				"辽东防线稳固度": 2
			}
		},
		{
			"id": "fiscal_policy",
			"name": "度支财计",
			"domain": "财政",
			"ability": "administration",
			"cost": 1,
			"desc": "询问国库、内帑、加派与地方积欠。",
			"effects": {
				"treasury_money": 80000,
				"皇权": 1
			}
		},
		{
			"id": "court_balance",
			"name": "朝局党争",
			"domain": "朝政",
			"ability": "intelligence",
			"cost": 1,
			"desc": "询问内廷、阁部、言官与党争分寸。",
			"effects": {
				"皇权": 1,
				"党争烈度": -1
			}
		},
		{
			"id": "relief_policy",
			"name": "民生赈济",
			"domain": "民生",
			"ability": "benevolence",
			"cost": 1,
			"desc": "询问流民、赈济、税粮与地方安抚。",
			"effects": {
				"民心": 1,
				"流民数量": -50000
			}
		}
	]

static func _default_region_governance_actions() -> Array:
	return [
		{
			"id": "relief",
			"name": "赈抚",
			"category": "民生",
			"cost": 1,
			"desc": "拨银赈济并责成地方抚辑，缓和民怨。",
			"effects": {
				"treasury_money": -80000,
				"minxin": 1
			},
			"region_effects": {
				"mood": 6,
				"unrest": -8,
				"tax_pressure": -2
			}
		},
		{
			"id": "survey",
			"name": "清丈",
			"category": "财政",
			"cost": 1,
			"desc": "清丈田亩、核验黄册，增收但扰动地方。",
			"effects": {
				"treasury_money": 60000,
				"huangquan": 1
			},
			"region_effects": {
				"development": 1,
				"tax_pressure": 4,
				"unrest": 2
			}
		},
		{
			"id": "fortify",
			"name": "修防",
			"category": "军务",
			"cost": 1,
			"desc": "修城堡、补器械、清军册，压低兵务压力。",
			"effects": {
				"treasury_money": -120000,
				"huangwei": 1
			},
			"region_effects": {
				"development": 1,
				"army_pressure": -7,
				"unrest": -2
			}
		},
		{
			"id": "appoint_governor",
			"name": "简任主官",
			"category": "任事",
			"cost": 1,
			"desc": "择行政、廉洁与忠诚较优者署理地方，使地块主官从运行状态中真实变更。",
			"assign_role": "governor",
			"assign_ability": "administration",
			"effects": {
				"huangquan": 1
			},
			"region_effects": {
				"mood": 2,
				"development": 1,
				"tax_pressure": -1
			}
		},
		{
			"id": "appoint_commander",
			"name": "简任镇将",
			"category": "军务",
			"cost": 1,
			"desc": "择军事、勇武与忠诚较优者统兵，更新地块统兵将领并缓和兵压。",
			"assign_role": "commander",
			"assign_ability": "military",
			"effects": {
				"huangwei": 1
			},
			"region_effects": {
				"army_pressure": -5,
				"unrest": -1
			}
		}
	]

static func _default_faction_actions() -> Array:
	return [
		{
			"id": "spy_network",
			"name": "布设耳目",
			"category": "情报",
			"cost": 1,
			"desc": "遣番役、商旅和边吏搜集目标势力动向，略耗国帑。",
			"effects": {
				"treasury_money": -40000,
				"huangquan": 1
			},
			"faction_effects": {
				"intelligence_known": 20,
				"cohesion": -2
			}
		},
		{
			"id": "sow_discord",
			"name": "离间部众",
			"category": "离间",
			"cost": 1,
			"desc": "借赏赐、谣言与旧怨离间目标势力内部部众。",
			"effects": {
				"treasury_money": -70000
			},
			"faction_effects": {
				"cohesion": -6,
				"border_tension": -2,
				"hostility": 2
			}
		},
		{
			"id": "appease_elites",
			"name": "怀柔贵酋",
			"category": "怀柔",
			"cost": 1,
			"desc": "赐赏、互市、封号并用，安抚目标上层。",
			"effects": {
				"treasury_money": -60000,
				"huangwei": 1
			},
			"faction_effects": {
				"relation_to_player": 8,
				"hostility": -6,
				"trade_access": 6
			}
		},
		{
			"id": "economic_pressure",
			"name": "控扼互市",
			"category": "威压",
			"cost": 1,
			"desc": "收紧互市、关隘和盐铁流通，以经济压力迫其收敛。",
			"effects": {
				"huangwei": 1
			},
			"faction_effects": {
				"trade_access": -10,
				"hostility": 5,
				"border_tension": 4,
				"economy": -2
			}
		},
		{
			"id": "assert_suzerainty",
			"name": "申明封疆",
			"category": "疆土",
			"cost": 1,
			"desc": "对目标势力所据地块重申朝廷封疆，把一处运行态地块的归属与控制权改隶大明。",
			"transfer_region": "to_player",
			"effects": {
				"huangwei": 2
			},
			"faction_effects": {
				"relation_to_player": -4,
				"hostility": 5,
				"border_tension": 5
			}
		}
	]

static func _default_edict_templates() -> Array:
	return [
		{
			"id": "reduce_regional_levy",
			"name": "减派蠲税",
			"category": "民生",
			"cost": 1,
			"requires_target": true,
			"desc": "指定一处地块暂减额外派征，缓和地方民怨。",
			"effects": {
				"treasury_money": -80000,
				"minxin": 1
			},
			"region_effects": {
				"mood": 5,
				"unrest": -6,
				"tax_pressure": -4
			}
		},
		{
			"id": "frontier_supply_order",
			"name": "整饬边备",
			"category": "军务",
			"cost": 1,
			"requires_target": true,
			"desc": "指定一处边防地块补给器械粮饷，压低军务压力。",
			"effects": {
				"treasury_money": -120000,
				"huangwei": 1
			},
			"region_effects": {
				"army_pressure": -5,
				"unrest": -2
			}
		},
		{
			"id": "inner_palace_austerity",
			"name": "裁省内用",
			"category": "财政",
			"cost": 1,
			"requires_target": false,
			"desc": "裁省宫中冗费，转补朝廷用度，但略损体面。",
			"effects": {
				"treasury_money": 100000,
				"huangwei": -1
			},
			"region_effects": {}
		}
	]

static func _default_military_order_templates() -> Array:
	return [
		{
			"id": "reinforce_garrison",
			"name": "增援驻防",
			"category": "驻防",
			"cost": 1,
			"desc": "拨银补械，向指定地块增派兵力，降低当地兵压。",
			"effects": {
				"treasury_money": -150000,
				"huangwei": 1
			},
			"region_effects": {
				"troops": 5000,
				"army_pressure": -8,
				"unrest": -2
			}
		},
		{
			"id": "demobilize_overburdened_garrison",
			"name": "裁撤疲兵",
			"category": "整军",
			"cost": 1,
			"desc": "在指定地块裁撤冗兵，降低兵压与军费负担，但减少当地兵力。",
			"effects": {
				"treasury_money": 60000
			},
			"region_effects": {
				"troops": -3000,
				"army_pressure": -10,
				"mood": 2
			}
		},
		{
			"id": "local_drill_order",
			"name": "操练营伍",
			"category": "训练",
			"cost": 1,
			"desc": "指定地块操练营伍，短期略增兵压，换取兵备整肃。",
			"effects": {
				"treasury_money": -50000,
				"huangwei": 1
			},
			"region_effects": {
				"army_pressure": 2,
				"unrest": -1
			}
		}
	]

static func _default_army_actions() -> Array:
	return [
		{
			"id": "pay_army_arrears",
			"name": "补发军饷",
			"category": "军饷",
			"cost": 1,
			"desc": "按具体军队补发积欠军饷，稳住军心并压低哗变风险。",
			"effects": {
				"treasury_money": -120000
			},
			"army_effects": {
				"pay_arrears_months": -2,
				"morale": 8,
				"loyalty": 6,
				"mutiny_risk": -12
			}
		},
		{
			"id": "drill_army",
			"name": "整训营伍",
			"category": "操练",
			"cost": 1,
			"desc": "点验营伍、整肃队列，使训练与统制上升。",
			"effects": {
				"treasury_money": -50000,
				"huangwei": 1
			},
			"army_effects": {
				"training": 8,
				"morale": 3,
				"control": 4,
				"mutiny_risk": -4
			}
		},
		{
			"id": "inspect_discipline",
			"name": "申明军纪",
			"category": "军纪",
			"cost": 1,
			"desc": "遣监军核验军册、申明号令，强化统制但略损将士亲附。",
			"effects": {
				"huangquan": 1
			},
			"army_effects": {
				"control": 8,
				"loyalty": -2,
				"mutiny_risk": -8
			}
		},
		{
			"id": "secure_garrison",
			"name": "驻地弹压",
			"category": "治安",
			"cost": 1,
			"desc": "令该军就地巡防、搜捕盗匪并弹压乱苗，直接安定当前驻地。",
			"effects": {
				"treasury_money": -30000,
				"huangwei": 1
			},
			"army_effects": {
				"control": 5,
				"morale": 2,
				"mutiny_risk": -3
			},
			"region_effects": {
				"unrest": -8,
				"army_pressure": -6,
				"mood": 4
			}
		},
		{
			"id": "recover_garrison_control",
			"name": "收复驻地",
			"category": "控制",
			"cost": 1,
			"desc": "令该军清剿驻地叛军或外控势力，使地块控制权回归合法归属方。",
			"effects": {
				"treasury_money": -60000,
				"huangwei": 1
			},
			"army_effects": {
				"control": 6,
				"morale": 3,
				"mutiny_risk": -4
			},
			"region_effects": {
				"unrest": -12,
				"army_pressure": -8,
				"mood": 5
			},
			"restore_owner_control": true
		}
	]

static func _default_diplomacy_actions() -> Array:
	return [
		{
			"id": "send_envoy",
			"name": "遣使修好",
			"category": "交涉",
			"cost": 1,
			"desc": "遣使携礼赴目标势力，改善关系并压低敌意。",
			"effects": {
				"treasury_money": -50000,
				"huangwei": 1
			},
			"faction_effects": {
				"relation_to_player": 12,
				"hostility": -10,
				"border_tension": -4
			}
		},
		{
			"id": "open_border_trade",
			"name": "开市互贸",
			"category": "贸易",
			"cost": 1,
			"desc": "允许有限互市，提升往来，但可能略损朝廷威严。",
			"effects": {
				"treasury_money": 80000,
				"huangwei": -1
			},
			"faction_effects": {
				"relation_to_player": 8,
				"hostility": -6,
				"trade_access": 15
			}
		},
		{
			"id": "support_chahar",
			"name": "援察哈尔",
			"category": "联蒙古",
			"cost": 1,
			"desc": "给察哈尔赏银、互市和火器匠役，使其牵制后金北翼。",
			"effects": {
				"treasury_money": -120000,
				"huangwei": 1
			},
			"faction_effects": {
				"relation_to_player": 18,
				"hostility": -8,
				"military_strength": 25000,
				"cohesion": 6,
				"ming_support": 1
			},
			"commitment": {
				"id": "support_chahar",
				"name": "援察哈尔",
				"duration_months": 2
			}
		},
		{
			"id": "demand_submission",
			"name": "责令输诚",
			"category": "威压",
			"cost": 1,
			"desc": "以朝廷名义责令目标势力输诚，抬高皇威但加剧敌意。",
			"effects": {
				"huangwei": 2
			},
			"faction_effects": {
				"relation_to_player": -6,
				"hostility": 10,
				"tribute_pressure": 12
			}
		}
	]

static func _default_court_meeting_topics() -> Array:
	return [
		{
			"id": "finance_council",
			"name": "清核度支",
			"domain": "finance",
			"cost": 1,
			"threshold": 70,
			"desc": "召集阁臣与户部官员清核度支，整顿收支。",
			"effects": {
				"huangquan": 1
			},
			"success_effects": {
				"treasury_money": 120000,
				"minxin": 1
			},
			"recommendations": [
				{
					"decision_key": "collect_arrears",
					"exclusive_group": "finance_followup",
					"name": "追缴积欠",
					"category": "财政",
					"cost": 1,
					"desc": "按会议清核结果追缴旧欠，短期充实国库。",
					"effects": {
						"treasury_money": 180000,
						"huangquan": 1
					},
					"followups": [
						{
							"decision_key": "audit_local_treasuries",
							"name": "复核地方库藏",
							"category": "财政",
							"cost": 1,
							"desc": "追缴之后继续核验地方库藏，寻找可持续财源。",
							"effects": {
								"treasury_money": 90000,
								"huangquan": 1
							}
						}
					]
				},
				{
					"decision_key": "cut_palace_expense",
					"exclusive_group": "finance_followup",
					"name": "裁抑内用",
					"category": "财政",
					"cost": 1,
					"desc": "以内廷节用替代追缴旧欠，少扰地方但损及宫中体面。",
					"effects": {
						"treasury_money": 100000,
						"inner_treasury_money": -70000,
						"huangwei": -1
					},
					"followups": [
						{
							"decision_key": "publish_austerity_register",
							"name": "公布节用清册",
							"category": "财政",
							"cost": 1,
							"desc": "将节用结果明示朝堂，换取臣民信任。",
							"effects": {
								"minxin": 1,
								"huangquan": 1
							}
						}
					]
				}
			]
		},
		{
			"id": "frontier_council",
			"name": "边务廷议",
			"domain": "frontier",
			"cost": 1,
			"threshold": 65,
			"desc": "召集兵部与边臣议辽东、九边军务。",
			"effects": {
				"huangquan": 1
			},
			"success_effects": {
				"huangwei": 2,
				"treasury_money": -80000
			},
			"recommendations": [
				{
					"name": "申饬边将",
					"category": "军务",
					"cost": 1,
					"desc": "按廷议申饬边将，整肃军令。",
					"effects": {
						"huangwei": 1,
						"辽饷积欠": -20
					}
				}
			]
		},
		{
			"id": "relief_council",
			"name": "赈济廷议",
			"domain": "relief",
			"cost": 1,
			"threshold": 65,
			"desc": "召集群臣议赈济、安抚与流民处置。",
			"effects": {
				"huangquan": 1
			},
			"success_effects": {
				"treasury_money": -100000,
				"minxin": 3
			},
			"recommendations": [
				{
					"name": "开仓赈济",
					"category": "民生",
					"cost": 1,
					"desc": "按廷议开仓赈济，继续降低流民压力。",
					"effects": {
						"treasury_grain": -80000,
						"流民数量": -80000,
						"minxin": 1
					}
				}
			]
		}
	]

static func _default_court_offices() -> Array:
	return [
		{"id": "neige_shoufu", "name": "内阁首辅", "domain": "朝政", "rank": 1, "keywords": ["内阁首辅", "首辅"]},
		{"id": "hubu_shangshu", "name": "户部尚书", "domain": "财政", "rank": 2, "keywords": ["户部尚书"]},
		{"id": "bingbu_shangshu", "name": "兵部尚书", "domain": "军务", "rank": 2, "keywords": ["兵部尚书"]},
		{"id": "liaodong_dushi", "name": "辽东督师", "domain": "辽东", "rank": 2, "keywords": ["辽东督师"]},
		{"id": "sanjun_zongdu", "name": "三边总督", "domain": "西北", "rank": 2, "keywords": ["三边总督"]}
	]

static func _initial_office_assignments(rows: Array, offices: Array) -> Dictionary:
	var assignments: Dictionary = {}
	for raw_office in offices:
		var office: Dictionary = _dict(raw_office)
		var office_id: String = str(office.get("id", ""))
		var keywords: Array = _array(office.get("keywords", []))
		for raw_character in rows:
			var character: Dictionary = _dict(raw_character)
			var title: String = str(character.get("official_title", character.get("title", "")))
			if title.contains("已罢") or title.contains("闲居") or title.contains("丁忧"):
				continue
			for raw_keyword in keywords:
				if title.contains(str(raw_keyword)):
					assignments[office_id] = str(character.get("id", ""))
					break
			if assignments.has(office_id):
				break
	return assignments

static func _build_variable_values(rows: Array) -> Dictionary:
	var values: Dictionary = {}
	for raw in rows:
		var row: Dictionary = _dict(raw)
		var name: String = str(row.get("name", ""))
		if name.is_empty():
			continue
		values[name] = _number(row.get("raw_value", row.get("value", 0)))
	return values

static func fmt_big(value: float, suffix: String = "") -> String:
	var abs_value: float = absf(value)
	if abs_value >= 100000000.0:
		return "%.1f亿%s" % [value / 100000000.0, suffix]
	if abs_value >= 10000.0:
		return "%.1f万%s" % [value / 10000.0, suffix]
	return "%d%s" % [roundi(value), suffix]

static func _signed_big(value: float, suffix: String = "") -> String:
	if value > 0.0:
		return "+%s" % fmt_big(value, suffix)
	if value < 0.0:
		return "-%s" % fmt_big(absf(value), suffix)
	return "0%s" % suffix

static func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

static func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

static func _number(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	var parsed: float = str(value).to_float()
	return parsed if is_finite(parsed) else 0.0
