extends Control

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const WorldMapPanelScript := preload("res://scripts/world_map_panel.gd")
const CharacterBrowserPanelScript := preload("res://scripts/character_browser_panel.gd")
const FactionBrowserPanelScript := preload("res://scripts/faction_browser_panel.gd")
const OverviewSummaryPanelScript := preload("res://scripts/overview_summary_panel.gd")
const MonthlyReportPanelScript := preload("res://scripts/monthly_report_panel.gd")
const ChroniclePanelScript := preload("res://scripts/chronicle_panel.gd")
const CommunicationPanelScript := preload("res://scripts/communication_panel.gd")
const AudiencePanelScript := preload("res://scripts/audience_panel.gd")
const RegionGovernancePanelScript := preload("res://scripts/region_governance_panel.gd")
const StatecraftPanelScript := preload("res://scripts/statecraft_panel.gd")
const EventQueuePanelScript := preload("res://scripts/event_queue_panel.gd")
const CourtActionPanelScript := preload("res://scripts/court_action_panel.gd")
const AppointmentPanelScript := preload("res://scripts/appointment_panel.gd")
const EdictPanelScript := preload("res://scripts/edict_panel.gd")
const MilitaryOrderPanelScript := preload("res://scripts/military_order_panel.gd")
const ArmyRosterPanelScript := preload("res://scripts/army_roster_panel.gd")
const DiplomacyPanelScript := preload("res://scripts/diplomacy_panel.gd")
const CourtMeetingPanelScript := preload("res://scripts/court_meeting_panel.gd")
const GameplayHubPanelScript := preload("res://scripts/gameplay_hub_panel.gd")
const RelationshipPanelScript := preload("res://scripts/relationship_panel.gd")
const SaveManagerScript := preload("res://scripts/save_manager.gd")
const SaveSlotPanelScript := preload("res://scripts/save_slot_panel.gd")
const SettingsManagerScript := preload("res://scripts/settings_manager.gd")
const SystemPanelScript := preload("res://scripts/system_panel.gd")

@onready var status_label: Label = %StatusLabel
@onready var vbox: VBoxContainer = $Panel/Margin/VBox

var world_map_panel: Control
var game_state: RefCounted
var character_browser_panel: Control
var faction_browser_panel: Control
var monthly_report_panel: Control
var chronicle_panel: Control
var communication_panel: Control
var audience_panel: Control
var region_governance_panel: Control
var statecraft_panel: Control
var event_queue_panel: Control
var court_action_panel: Control
var appointment_panel: Control
var edict_panel: Control
var military_order_panel: Control
var army_roster_panel: Control
var diplomacy_panel: Control
var court_meeting_panel: Control
var gameplay_hub_panel: Control
var relationship_panel: Control
var save_slot_panel: Control
var system_panel: Control
var primary_tabs: TabContainer
var overview_summary_panel: Control
var save_manager: RefCounted
var settings_manager: RefCounted
var quick_save_slot_id: String = "quick"

func _ready() -> void:
	var result := ScenarioLoaderScript.load_official_summary()
	if not result.get("ok", false):
		status_label.text = "Godot runtime ready\n%s" % str(result.get("error", "scenario load failed"))
		push_warning(status_label.text)
		return

	game_state = GameStateScript.new()
	var state_result: Dictionary = game_state.load_from_scenario_result(result)
	if not state_result.get("ok", false):
		status_label.text = "Godot runtime ready\n%s" % str(state_result.get("error", "state load failed"))
		push_warning(status_label.text)
		return
	game_state.connect("state_changed", Callable(self, "_refresh_runtime_bar"))
	save_manager = SaveManagerScript.new()
	settings_manager = SettingsManagerScript.new()
	settings_manager.call("load_settings")

	var summary: Dictionary = game_state.summary
	status_label.text = "%s\n%s · %s · %s" % [
		summary["name"],
		summary["dynasty"],
		summary["era"],
		summary["emperor"]
	]
	print("[TianmingGodot] loaded scenario: %s chars=%d factions=%d map_regions=%d" % [
		summary["name"],
		summary["characters"],
		summary["factions"],
		summary["map_regions"]
	])
	if game_state.scenario_cache != null:
		print("[TianmingGodot] %s" % game_state.scenario_cache.summary_counts_text())

	_add_overview_summary(summary)
	_add_data_tabs()

func _add_overview_summary(summary: Dictionary) -> void:
	overview_summary_panel = OverviewSummaryPanelScript.new()
	overview_summary_panel.name = "概览"
	overview_summary_panel.connect("advance_month_requested", Callable(self, "_on_advance_month_pressed"))
	vbox.add_child(overview_summary_panel)
	overview_summary_panel.call("set_summary", summary)
	overview_summary_panel.call("set_runtime_snapshot", _overview_runtime_snapshot())

func _live_summary_value(metric_key: String) -> String:
	if game_state == null:
		return ""
	match metric_key:
		"characters_count":
			return "%d 人" % _safe_array(game_state.get("characters")).size()
		"factions_count":
			return "%d 个" % _safe_array(game_state.get("factions")).size()
		"party_class_count":
			var characters: Array = _safe_array(game_state.get("characters"))
			return "%d / %d" % [
				_unique_field_count(characters, "party"),
				_unique_field_count(characters, "social_class")
			]
		"variables_count":
			return "%d 项" % _safe_array(game_state.get("variables")).size()
		"events_count":
			return "%d 件" % _safe_array(game_state.get("event_deck")).size()
		"map_regions_count":
			return "%d 块" % _safe_array(game_state.get("map_regions")).size()
		"guoku_money":
			return ScenarioLoaderScript.fmt_big(_num(game_state.get("guoku_money")), "")
		"guoku_grain":
			return ScenarioLoaderScript.fmt_big(_num(game_state.get("guoku_grain")), "")
		"neitang_money":
			return ScenarioLoaderScript.fmt_big(_num(game_state.get("neitang_money")), "")
		"population_registered":
			return ScenarioLoaderScript.fmt_big(_num(game_state.get("population_registered")), "")
		"population_hidden":
			return ScenarioLoaderScript.fmt_big(_num(game_state.get("population_hidden")), "")
		"huangquan":
			return "%d" % roundi(_num(game_state.get("huangquan")))
		"huangwei":
			return "%d" % roundi(_num(game_state.get("huangwei")))
		"minxin":
			return "%d" % roundi(_num(game_state.get("minxin")))
	return ""

func _overview_runtime_snapshot() -> Dictionary:
	var metrics: Dictionary = {}
	for key in [
		"characters_count",
		"factions_count",
		"party_class_count",
		"variables_count",
		"events_count",
		"map_regions_count",
		"guoku_money",
		"guoku_grain",
		"neitang_money",
		"population_registered",
		"population_hidden",
		"huangquan",
		"huangwei",
		"minxin"
	]:
		metrics[key] = _live_summary_value(key)
	return {
		"date_text": game_state.date_text() if game_state != null else "",
		"treasury_text": game_state.treasury_text() if game_state != null else "",
		"neitang_text": game_state.neitang_text() if game_state != null else "",
		"authority_text": game_state.authority_text() if game_state != null else "",
		"population_text": game_state.population_text() if game_state != null else "",
		"report_text": game_state.last_report_text() if game_state != null else "",
		"metrics": metrics
	}

func _unique_field_count(rows: Array, key: String) -> int:
	var seen: Dictionary = {}
	for raw in rows:
		var row: Dictionary = _safe_dict(raw)
		var value: String = str(row.get(key, ""))
		if not value.is_empty():
			seen[value] = true
	return seen.size()

func _refresh_runtime_bar() -> void:
	if game_state == null:
		return
	if overview_summary_panel != null:
		overview_summary_panel.call("set_runtime_snapshot", _overview_runtime_snapshot())
	if world_map_panel != null and game_state.has_method("map_view_data"):
		world_map_panel.call("set_map_data", game_state.call("map_view_data"))
	if faction_browser_panel != null and game_state.has_method("faction_actions"):
		faction_browser_panel.call("set_data", _safe_array(game_state.get("factions")), game_state.call("faction_actions"), _safe_array(game_state.get("faction_action_history")), int(_num(game_state.get("action_points"))))
	if character_browser_panel != null and game_state.has_method("character_actions"):
		character_browser_panel.call("set_data", _safe_array(game_state.get("characters")), game_state.call("character_actions"), _safe_array(game_state.get("character_action_history")), int(_num(game_state.get("action_points"))))
	if monthly_report_panel != null:
		monthly_report_panel.call("set_reports", _monthly_report_rows())
	if chronicle_panel != null and game_state.has_method("chronicle_entries"):
		chronicle_panel.call("set_entries", game_state.call("chronicle_entries"))
	if communication_panel != null and game_state.has_method("communication_items"):
		communication_panel.call("set_data", game_state.call("communication_items"), _safe_array(game_state.get("communication_archive")))
	if audience_panel != null and game_state.has_method("audience_topics"):
		audience_panel.call("set_data", _safe_array(game_state.get("characters")), game_state.call("audience_topics"), _safe_array(game_state.get("audience_history")), int(_num(game_state.get("action_points"))))
	if region_governance_panel != null and game_state.has_method("region_governance_actions"):
		region_governance_panel.call("set_data", _safe_array(game_state.get("map_regions")), game_state.call("region_governance_actions"), _safe_array(game_state.get("region_governance_history")), int(_num(game_state.get("action_points"))))
	if statecraft_panel != null and game_state.has_method("statecraft_actions"):
		var variable_rows: Array = game_state.call("variable_rows") if game_state.has_method("variable_rows") else _safe_array(game_state.get("variables"))
		statecraft_panel.call("set_data", variable_rows, game_state.call("statecraft_actions"), _safe_array(game_state.get("statecraft_history")), int(_num(game_state.get("action_points"))))
	if event_queue_panel != null:
		event_queue_panel.call("set_events", _safe_array(game_state.get("event_queue")), _safe_array(game_state.get("resolved_events")))
	if court_action_panel != null:
		court_action_panel.call("set_actions", _safe_array(game_state.get("player_actions")), int(_num(game_state.get("action_points"))), _safe_array(game_state.get("action_history")))
	if appointment_panel != null:
		appointment_panel.call("set_data", _safe_array(game_state.get("court_offices")), _safe_array(game_state.get("characters")), _safe_dict(game_state.get("office_assignments")), _safe_array(game_state.get("appointment_history")), int(_num(game_state.get("action_points"))))
	if edict_panel != null:
		edict_panel.call("set_data", _safe_array(game_state.get("edict_templates")), _safe_array(game_state.get("map_regions")), _safe_array(game_state.get("issued_edicts")), int(_num(game_state.get("action_points"))))
	if military_order_panel != null:
		military_order_panel.call("set_data", _safe_array(game_state.get("military_order_templates")), _safe_array(game_state.get("map_regions")), _safe_array(game_state.get("issued_military_orders")), int(_num(game_state.get("action_points"))))
	if army_roster_panel != null:
		var army_actions: Array = game_state.call("army_actions") if game_state.has_method("army_actions") else []
		army_roster_panel.call("set_data", _safe_array(game_state.get("armies")), _safe_array(game_state.get("characters")), _safe_array(game_state.get("army_command_history")), int(_num(game_state.get("action_points"))), army_actions, _safe_array(game_state.get("army_action_history")), _safe_array(game_state.get("map_regions")), _safe_array(game_state.get("army_redeployment_history")))
	if diplomacy_panel != null:
		diplomacy_panel.call("set_data", _safe_array(game_state.get("diplomacy_actions")), _safe_array(game_state.get("factions")), _safe_array(game_state.get("diplomacy_history")), int(_num(game_state.get("action_points"))), _safe_array(game_state.get("active_diplomacy_commitments")))
	if court_meeting_panel != null:
		court_meeting_panel.call("set_data", _safe_array(game_state.get("court_meeting_topics")), _safe_array(game_state.get("characters")), _safe_array(game_state.get("court_meeting_history")), int(_num(game_state.get("action_points"))), _safe_array(game_state.get("pending_court_recommendations")), _safe_array(game_state.get("enacted_court_recommendations")))
	if gameplay_hub_panel != null:
		gameplay_hub_panel.call("set_snapshot", game_state.call("gameplay_hub_snapshot", _has_quick_save()))
	if relationship_panel != null and game_state.has_method("relationship_rows"):
		relationship_panel.call("set_data", game_state.call("relationship_rows"))
	if save_slot_panel != null:
		save_slot_panel.call("set_slots", _save_slot_rows())
	if system_panel != null:
		system_panel.call("set_data", _settings_snapshot(), _has_quick_save())

func _on_advance_month_pressed() -> void:
	if game_state == null:
		return
	game_state.advance_month()
	print("[TianmingGodot] advanced month: %s | %s" % [
		game_state.date_text(),
		game_state.last_report_text()
	])

func _on_quick_save_requested() -> void:
	if game_state == null or save_manager == null:
		return
	var result: Dictionary = save_manager.call("save_to_slot", game_state, quick_save_slot_id)
	if not result.get("ok", false):
		push_warning("quick save failed: %s" % str(result.get("error", "")))
		return
	if system_panel != null:
		system_panel.call("set_status", "已快速保存：%s" % game_state.date_text())
	print("[TianmingGodot] quick saved: %s" % game_state.date_text())
	_refresh_runtime_bar()

func _on_quick_load_requested() -> void:
	var result: Dictionary = continue_from_quick_save()
	if not result.get("ok", false):
		push_warning("quick load failed: %s" % str(result.get("error", "")))
		return
	if system_panel != null:
		system_panel.call("set_status", "已快速读取：%s" % game_state.date_text())

func continue_from_quick_save() -> Dictionary:
	if game_state == null or save_manager == null:
		return {
			"ok": false,
			"error": "game state or save manager is not ready"
		}
	var result: Dictionary = save_manager.call("restore_slot", game_state, quick_save_slot_id)
	if not result.get("ok", false):
		return result
	print("[TianmingGodot] quick loaded: %s" % game_state.date_text())
	_refresh_runtime_bar()
	return {
		"ok": true,
		"metadata": _safe_dict(result.get("metadata", {}))
	}

func _on_save_slot_requested(slot_id: String) -> void:
	if game_state == null or save_manager == null:
		return
	var result: Dictionary = save_manager.call("save_to_slot", game_state, slot_id)
	if not result.get("ok", false):
		push_warning("save slot failed: %s" % str(result.get("error", "")))
		if save_slot_panel != null:
			save_slot_panel.call("set_status", "保存失败：%s" % str(result.get("error", "")))
		return
	if save_slot_panel != null:
		save_slot_panel.call("set_status", "已保存到 %s：%s" % [slot_id, game_state.date_text()])
	print("[TianmingGodot] save slot %s: %s" % [slot_id, game_state.date_text()])
	_refresh_runtime_bar()

func _on_load_slot_requested(slot_id: String) -> void:
	if game_state == null or save_manager == null:
		return
	var result: Dictionary = save_manager.call("restore_slot", game_state, slot_id)
	if not result.get("ok", false):
		push_warning("load slot failed: %s" % str(result.get("error", "")))
		if save_slot_panel != null:
			save_slot_panel.call("set_status", "读取失败：%s" % str(result.get("error", "")))
		return
	if save_slot_panel != null:
		save_slot_panel.call("set_status", "已读取 %s：%s" % [slot_id, game_state.date_text()])
	print("[TianmingGodot] load slot %s: %s" % [slot_id, game_state.date_text()])
	_refresh_runtime_bar()

func _on_delete_slot_requested(slot_id: String) -> void:
	if save_manager == null:
		return
	var result: Dictionary = save_manager.call("delete_slot", slot_id)
	if not result.get("ok", false):
		push_warning("delete slot failed: %s" % str(result.get("error", "")))
		if save_slot_panel != null:
			save_slot_panel.call("set_status", "删除失败：%s" % str(result.get("error", "")))
		return
	if save_slot_panel != null:
		save_slot_panel.call("set_status", "已删除 %s" % slot_id)
	print("[TianmingGodot] delete slot %s" % slot_id)
	_refresh_runtime_bar()

func _on_system_settings_apply(values: Dictionary) -> void:
	if settings_manager == null:
		return
	var result: Dictionary = settings_manager.call("update_settings", values)
	if not result.get("ok", false):
		push_warning("system settings failed: %s" % str(result.get("error", "")))
		if system_panel != null:
			system_panel.call("set_status", "设置失败：%s" % str(result.get("error", "")))
		return
	if system_panel != null:
		system_panel.call("set_status", "设置已保存。")
	_refresh_runtime_bar()

func request_return_to_title() -> Dictionary:
	var parent_node: Node = get_parent()
	if parent_node != null and parent_node.has_method("return_to_title"):
		parent_node.call("return_to_title")
		return {"ok": true}
	return {
		"ok": false,
		"error": "no title screen parent is available"
	}

func _on_return_title_requested() -> void:
	var result: Dictionary = request_return_to_title()
	if not result.get("ok", false):
		push_warning("return title failed: %s" % str(result.get("error", "")))
		if system_panel != null:
			system_panel.call("set_status", "返回标题失败：%s" % str(result.get("error", "")))

func _save_slot_rows() -> Array:
	if save_manager == null:
		return []
	return _safe_array(save_manager.call("list_slots"))

func _settings_snapshot() -> Dictionary:
	if settings_manager == null:
		return {}
	return _safe_dict(settings_manager.call("settings_snapshot"))

func _has_quick_save() -> bool:
	if save_manager == null:
		return false
	var metadata: Dictionary = save_manager.call("slot_metadata", quick_save_slot_id)
	return bool(metadata.get("exists", false))

func _add_data_tabs() -> void:
	var tabs: TabContainer = TabContainer.new()
	primary_tabs = tabs
	tabs.custom_minimum_size = Vector2(0, 300)
	tabs.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(tabs)

	_add_gameplay_hub_tab(tabs)
	_add_save_slot_tab(tabs)
	_add_system_tab(tabs)
	_add_court_action_tab(tabs)
	_add_court_meeting_tab(tabs)
	_add_edict_tab(tabs)
	_add_military_order_tab(tabs)
	_add_army_roster_tab(tabs)
	_add_diplomacy_tab(tabs)
	_add_appointment_tab(tabs)
	_add_audience_tab(tabs)
	_add_relationship_tab(tabs)
	_add_faction_tab(tabs)
	_add_monthly_report_tab(tabs)
	_add_chronicle_tab(tabs)
	_add_communication_tab(tabs)
	_add_event_queue_tab(tabs)
	_add_map_tab(tabs)
	_add_region_governance_tab(tabs)
	_add_character_tab(tabs)
	_add_statecraft_tab(tabs)

func _add_gameplay_hub_tab(tabs: TabContainer) -> void:
	gameplay_hub_panel = GameplayHubPanelScript.new()
	gameplay_hub_panel.name = "御览"
	gameplay_hub_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	gameplay_hub_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	gameplay_hub_panel.connect("advance_month_requested", Callable(self, "_on_advance_month_pressed"))
	gameplay_hub_panel.connect("tab_requested", Callable(self, "_select_tab_by_name"))
	gameplay_hub_panel.connect("save_requested", Callable(self, "_on_quick_save_requested"))
	gameplay_hub_panel.connect("load_requested", Callable(self, "_on_quick_load_requested"))
	tabs.add_child(gameplay_hub_panel)
	if game_state != null:
		gameplay_hub_panel.call("set_snapshot", game_state.call("gameplay_hub_snapshot", _has_quick_save()))

func _add_save_slot_tab(tabs: TabContainer) -> void:
	save_slot_panel = SaveSlotPanelScript.new()
	save_slot_panel.name = "存档"
	save_slot_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	save_slot_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	save_slot_panel.connect("save_slot_requested", Callable(self, "_on_save_slot_requested"))
	save_slot_panel.connect("load_slot_requested", Callable(self, "_on_load_slot_requested"))
	save_slot_panel.connect("delete_slot_requested", Callable(self, "_on_delete_slot_requested"))
	tabs.add_child(save_slot_panel)
	save_slot_panel.call("set_slots", _save_slot_rows())

func _add_system_tab(tabs: TabContainer) -> void:
	system_panel = SystemPanelScript.new()
	system_panel.name = "系统"
	system_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	system_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	system_panel.connect("quick_save_requested", Callable(self, "_on_quick_save_requested"))
	system_panel.connect("quick_load_requested", Callable(self, "_on_quick_load_requested"))
	system_panel.connect("settings_apply_requested", Callable(self, "_on_system_settings_apply"))
	system_panel.connect("return_title_requested", Callable(self, "_on_return_title_requested"))
	tabs.add_child(system_panel)
	system_panel.call("set_data", _settings_snapshot(), _has_quick_save())

func _add_relationship_tab(tabs: TabContainer) -> void:
	relationship_panel = RelationshipPanelScript.new()
	relationship_panel.name = "关系"
	relationship_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	relationship_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tabs.add_child(relationship_panel)
	if game_state != null and game_state.has_method("relationship_rows"):
		relationship_panel.call("set_data", game_state.call("relationship_rows"))

func _select_tab_by_name(tab_name: String) -> void:
	if primary_tabs == null:
		return
	for i in range(primary_tabs.get_child_count()):
		if primary_tabs.get_child(i).name == tab_name:
			primary_tabs.current_tab = i
			return

func _add_court_action_tab(tabs: TabContainer) -> void:
	court_action_panel = CourtActionPanelScript.new()
	court_action_panel.name = "行动"
	court_action_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	court_action_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	court_action_panel.connect("action_requested", Callable(self, "_on_court_action_requested"))
	tabs.add_child(court_action_panel)
	if game_state != null:
		court_action_panel.call("set_actions", _safe_array(game_state.get("player_actions")), int(_num(game_state.get("action_points"))), _safe_array(game_state.get("action_history")))

func _on_court_action_requested(action_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("perform_player_action", action_id)
	if not result.get("ok", false):
		push_warning("court action failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] player action: %s" % str(_safe_dict(result.get("action", {})).get("name", action_id)))
	_refresh_runtime_bar()

func _add_court_meeting_tab(tabs: TabContainer) -> void:
	court_meeting_panel = CourtMeetingPanelScript.new()
	court_meeting_panel.name = "御前会议"
	court_meeting_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	court_meeting_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	court_meeting_panel.connect("court_meeting_requested", Callable(self, "_on_court_meeting_requested"))
	court_meeting_panel.connect("court_recommendation_requested", Callable(self, "_on_court_recommendation_requested"))
	tabs.add_child(court_meeting_panel)
	if game_state != null:
		court_meeting_panel.call("set_data", _safe_array(game_state.get("court_meeting_topics")), _safe_array(game_state.get("characters")), _safe_array(game_state.get("court_meeting_history")), int(_num(game_state.get("action_points"))), _safe_array(game_state.get("pending_court_recommendations")), _safe_array(game_state.get("enacted_court_recommendations")))

func _on_court_meeting_requested(topic_id: String, participant_ids: Array) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("hold_court_meeting", topic_id, participant_ids)
	if not result.get("ok", false):
		push_warning("court meeting failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] court meeting: %s -> %s %.0f" % [
		str(_safe_dict(result.get("topic", {})).get("name", topic_id)),
		str(result.get("outcome", "")),
		_num(result.get("score", 0))
	])
	_refresh_runtime_bar()

func _on_court_recommendation_requested(recommendation_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("enact_court_recommendation", recommendation_id)
	if not result.get("ok", false):
		push_warning("court recommendation failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] court recommendation: %s" % str(_safe_dict(result.get("recommendation", {})).get("name", recommendation_id)))
	_refresh_runtime_bar()

func _add_edict_tab(tabs: TabContainer) -> void:
	edict_panel = EdictPanelScript.new()
	edict_panel.name = "诏令"
	edict_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	edict_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	edict_panel.connect("edict_requested", Callable(self, "_on_edict_requested"))
	tabs.add_child(edict_panel)
	if game_state != null:
		edict_panel.call("set_data", _safe_array(game_state.get("edict_templates")), _safe_array(game_state.get("map_regions")), _safe_array(game_state.get("issued_edicts")), int(_num(game_state.get("action_points"))))

func _on_edict_requested(edict_id: String, target_region_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("issue_edict", edict_id, target_region_id)
	if not result.get("ok", false):
		push_warning("edict failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] edict: %s -> %s" % [
		str(_safe_dict(result.get("edict", {})).get("name", edict_id)),
		str(_safe_dict(result.get("record", {})).get("target_region", ""))
	])
	_refresh_runtime_bar()

func _add_military_order_tab(tabs: TabContainer) -> void:
	military_order_panel = MilitaryOrderPanelScript.new()
	military_order_panel.name = "军令"
	military_order_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	military_order_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	military_order_panel.connect("military_order_requested", Callable(self, "_on_military_order_requested"))
	tabs.add_child(military_order_panel)
	if game_state != null:
		military_order_panel.call("set_data", _safe_array(game_state.get("military_order_templates")), _safe_array(game_state.get("map_regions")), _safe_array(game_state.get("issued_military_orders")), int(_num(game_state.get("action_points"))))

func _on_military_order_requested(order_id: String, target_region_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("issue_military_order", order_id, target_region_id)
	if not result.get("ok", false):
		push_warning("military order failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] military order: %s -> %s" % [
		str(_safe_dict(result.get("order", {})).get("name", order_id)),
		str(_safe_dict(result.get("record", {})).get("target_region", ""))
	])
	_refresh_runtime_bar()

func _add_army_roster_tab(tabs: TabContainer) -> void:
	army_roster_panel = ArmyRosterPanelScript.new()
	army_roster_panel.name = "军队"
	army_roster_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	army_roster_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	army_roster_panel.connect("army_commander_requested", Callable(self, "_on_army_commander_requested"))
	army_roster_panel.connect("army_action_requested", Callable(self, "_on_army_action_requested"))
	army_roster_panel.connect("army_redeploy_requested", Callable(self, "_on_army_redeploy_requested"))
	tabs.add_child(army_roster_panel)
	if game_state != null:
		var army_actions: Array = game_state.call("army_actions") if game_state.has_method("army_actions") else []
		army_roster_panel.call("set_data", _safe_array(game_state.get("armies")), _safe_array(game_state.get("characters")), _safe_array(game_state.get("army_command_history")), int(_num(game_state.get("action_points"))), army_actions, _safe_array(game_state.get("army_action_history")), _safe_array(game_state.get("map_regions")), _safe_array(game_state.get("army_redeployment_history")))

func _on_army_commander_requested(army_id: String, character_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("appoint_army_commander", army_id, character_id)
	if not result.get("ok", false):
		push_warning("army commander assignment failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] army commander: %s" % str(_safe_dict(result.get("record", {})).get("name", army_id)))
	_refresh_runtime_bar()

func _on_army_action_requested(army_id: String, action_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("issue_army_action", action_id, army_id)
	if not result.get("ok", false):
		push_warning("army action failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] army action: %s -> %s" % [
		str(_safe_dict(result.get("action", {})).get("name", action_id)),
		str(_safe_dict(result.get("record", {})).get("army", army_id))
	])
	_refresh_runtime_bar()

func _on_army_redeploy_requested(army_id: String, target_region_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("redeploy_army", army_id, target_region_id)
	if not result.get("ok", false):
		push_warning("army redeployment failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] army redeploy: %s -> %s" % [
		str(_safe_dict(result.get("record", {})).get("army", army_id)),
		str(_safe_dict(result.get("record", {})).get("target_region", target_region_id))
	])
	_refresh_runtime_bar()

func _add_diplomacy_tab(tabs: TabContainer) -> void:
	diplomacy_panel = DiplomacyPanelScript.new()
	diplomacy_panel.name = "外交"
	diplomacy_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	diplomacy_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	diplomacy_panel.connect("diplomacy_requested", Callable(self, "_on_diplomacy_requested"))
	diplomacy_panel.connect("diplomacy_commitment_renew_requested", Callable(self, "_on_diplomacy_commitment_renew_requested"))
	diplomacy_panel.connect("diplomacy_commitment_break_requested", Callable(self, "_on_diplomacy_commitment_break_requested"))
	tabs.add_child(diplomacy_panel)
	if game_state != null:
		diplomacy_panel.call("set_data", _safe_array(game_state.get("diplomacy_actions")), _safe_array(game_state.get("factions")), _safe_array(game_state.get("diplomacy_history")), int(_num(game_state.get("action_points"))), _safe_array(game_state.get("active_diplomacy_commitments")))

func _on_diplomacy_requested(action_id: String, target_faction_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("issue_diplomacy_action", action_id, target_faction_id)
	if not result.get("ok", false):
		push_warning("diplomacy failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] diplomacy: %s -> %s" % [
		str(_safe_dict(result.get("action", {})).get("name", action_id)),
		str(_safe_dict(result.get("record", {})).get("target_faction", ""))
	])
	_refresh_runtime_bar()

func _on_diplomacy_commitment_renew_requested(commitment_id: String, target_faction_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("renew_diplomacy_commitment", commitment_id, target_faction_id)
	if not result.get("ok", false):
		push_warning("renew diplomacy commitment failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] renew diplomacy commitment: %s -> %s" % [
		str(_safe_dict(result.get("record", {})).get("name", commitment_id)),
		str(_safe_dict(result.get("record", {})).get("target_faction", target_faction_id))
	])
	_refresh_runtime_bar()

func _on_diplomacy_commitment_break_requested(commitment_id: String, target_faction_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("break_diplomacy_commitment", commitment_id, target_faction_id)
	if not result.get("ok", false):
		push_warning("break diplomacy commitment failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] break diplomacy commitment: %s -> %s" % [
		str(_safe_dict(result.get("record", {})).get("name", commitment_id)),
		str(_safe_dict(result.get("record", {})).get("target_faction", target_faction_id))
	])
	_refresh_runtime_bar()

func _add_appointment_tab(tabs: TabContainer) -> void:
	appointment_panel = AppointmentPanelScript.new()
	appointment_panel.name = "任免"
	appointment_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	appointment_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	appointment_panel.connect("appointment_requested", Callable(self, "_on_appointment_requested"))
	tabs.add_child(appointment_panel)
	if game_state != null:
		appointment_panel.call("set_data", _safe_array(game_state.get("court_offices")), _safe_array(game_state.get("characters")), _safe_dict(game_state.get("office_assignments")), _safe_array(game_state.get("appointment_history")), int(_num(game_state.get("action_points"))))

func _on_appointment_requested(character_id: String, office_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("appoint_character", character_id, office_id)
	if not result.get("ok", false):
		push_warning("appointment failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] appointment: %s -> %s" % [
		str(_safe_dict(result.get("character", {})).get("name", character_id)),
		str(_safe_dict(result.get("office", {})).get("name", office_id))
	])
	_refresh_runtime_bar()

func _add_audience_tab(tabs: TabContainer) -> void:
	audience_panel = AudiencePanelScript.new()
	audience_panel.name = "问对"
	audience_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	audience_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	audience_panel.connect("audience_requested", Callable(self, "_on_audience_requested"))
	tabs.add_child(audience_panel)
	if game_state != null and game_state.has_method("audience_topics"):
		audience_panel.call("set_data", _safe_array(game_state.get("characters")), game_state.call("audience_topics"), _safe_array(game_state.get("audience_history")), int(_num(game_state.get("action_points"))))

func _on_audience_requested(character_id: String, topic_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("hold_audience", character_id, topic_id)
	if not result.get("ok", false):
		push_warning("audience failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] audience: %s -> %s" % [
		str(_safe_dict(result.get("character", {})).get("name", character_id)),
		str(_safe_dict(result.get("topic", {})).get("name", topic_id))
	])
	_refresh_runtime_bar()

func _add_region_governance_tab(tabs: TabContainer) -> void:
	region_governance_panel = RegionGovernancePanelScript.new()
	region_governance_panel.name = "地块"
	region_governance_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	region_governance_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	region_governance_panel.connect("region_governance_requested", Callable(self, "_on_region_governance_requested"))
	tabs.add_child(region_governance_panel)
	if game_state != null and game_state.has_method("region_governance_actions"):
		region_governance_panel.call("set_data", _safe_array(game_state.get("map_regions")), game_state.call("region_governance_actions"), _safe_array(game_state.get("region_governance_history")), int(_num(game_state.get("action_points"))))

func _on_region_governance_requested(region_id: String, action_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("perform_region_governance", region_id, action_id)
	if not result.get("ok", false):
		push_warning("region governance failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] region governance: %s -> %s" % [
		str(_safe_dict(result.get("target_region", {})).get("name", region_id)),
		str(_safe_dict(result.get("action", {})).get("name", action_id))
	])
	_refresh_runtime_bar()

func _add_statecraft_tab(tabs: TabContainer) -> void:
	statecraft_panel = StatecraftPanelScript.new()
	statecraft_panel.name = "变量"
	statecraft_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	statecraft_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	statecraft_panel.connect("statecraft_action_requested", Callable(self, "_on_statecraft_action_requested"))
	tabs.add_child(statecraft_panel)
	if game_state != null and game_state.has_method("statecraft_actions"):
		var variable_rows: Array = game_state.call("variable_rows") if game_state.has_method("variable_rows") else _safe_array(game_state.get("variables"))
		statecraft_panel.call("set_data", variable_rows, game_state.call("statecraft_actions"), _safe_array(game_state.get("statecraft_history")), int(_num(game_state.get("action_points"))))

func _on_statecraft_action_requested(variable_name: String, action_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("perform_statecraft_action", variable_name, action_id)
	if not result.get("ok", false):
		push_warning("statecraft action failed: %s" % str(result.get("error", "")))
		return
	if statecraft_panel != null:
		statecraft_panel.call("select_variable", variable_name)
	print("[TianmingGodot] statecraft: %s -> %s" % [
		variable_name,
		str(_safe_dict(result.get("action", {})).get("name", action_id))
	])
	_refresh_runtime_bar()

func _add_monthly_report_tab(tabs: TabContainer) -> void:
	monthly_report_panel = MonthlyReportPanelScript.new()
	monthly_report_panel.name = "月报"
	monthly_report_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	monthly_report_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tabs.add_child(monthly_report_panel)
	if game_state != null:
		monthly_report_panel.call("set_reports", _monthly_report_rows())

func _monthly_report_rows() -> Array:
	if game_state == null:
		return []
	var reports: Array = _safe_array(game_state.get("turn_reports")).duplicate(true)
	if reports.is_empty():
		var preview: Dictionary = _safe_dict(game_state.get("last_turn_report"))
		if not preview.is_empty():
			reports.append(preview)
	return reports

func _add_chronicle_tab(tabs: TabContainer) -> void:
	chronicle_panel = ChroniclePanelScript.new()
	chronicle_panel.name = "史官实录"
	chronicle_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	chronicle_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tabs.add_child(chronicle_panel)
	if game_state != null and game_state.has_method("chronicle_entries"):
		chronicle_panel.call("set_entries", game_state.call("chronicle_entries"))

func _add_communication_tab(tabs: TabContainer) -> void:
	communication_panel = CommunicationPanelScript.new()
	communication_panel.name = "奏疏来文"
	communication_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	communication_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	communication_panel.connect("communication_process_requested", Callable(self, "_on_communication_process_requested"))
	tabs.add_child(communication_panel)
	if game_state != null and game_state.has_method("communication_items"):
		communication_panel.call("set_data", game_state.call("communication_items"), _safe_array(game_state.get("communication_archive")))

func _on_communication_process_requested(communication_id: String, action: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("process_communication", communication_id, action)
	if not result.get("ok", false):
		push_warning("process communication failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] communication %s: %s" % [
		action,
		str(_safe_dict(result.get("communication", {})).get("title", communication_id))
	])
	_refresh_runtime_bar()

func _add_event_queue_tab(tabs: TabContainer) -> void:
	event_queue_panel = EventQueuePanelScript.new()
	event_queue_panel.name = "事件"
	event_queue_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	event_queue_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	event_queue_panel.connect("event_resolve_requested", Callable(self, "_on_event_resolve_requested"))
	tabs.add_child(event_queue_panel)
	if game_state != null:
		event_queue_panel.call("set_events", _safe_array(game_state.get("event_queue")), _safe_array(game_state.get("resolved_events")))

func _on_event_resolve_requested(event_id: String, choice_index: int) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("resolve_event", event_id, choice_index)
	if not result.get("ok", false):
		push_warning("resolve event failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] resolved event: %s" % str(_safe_dict(result.get("event", {})).get("name", event_id)))
	_refresh_runtime_bar()

func _add_faction_tab(tabs: TabContainer) -> void:
	faction_browser_panel = FactionBrowserPanelScript.new()
	faction_browser_panel.name = "势力"
	faction_browser_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	faction_browser_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	faction_browser_panel.connect("faction_action_requested", Callable(self, "_on_faction_action_requested"))
	tabs.add_child(faction_browser_panel)
	var rows: Array = _safe_array(game_state.get("factions")) if game_state != null else []
	var action_rows: Array = game_state.call("faction_actions") if game_state != null and game_state.has_method("faction_actions") else []
	var history: Array = _safe_array(game_state.get("faction_action_history")) if game_state != null else []
	var action_points: int = int(_num(game_state.get("action_points"))) if game_state != null else 0
	faction_browser_panel.call("set_data", rows, action_rows, history, action_points)

func _on_faction_action_requested(faction_id: String, action_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("perform_faction_action", faction_id, action_id)
	if not result.get("ok", false):
		push_warning("faction action failed: %s" % str(result.get("error", "")))
		return
	if faction_browser_panel != null:
		faction_browser_panel.call("select_faction", faction_id)
	print("[TianmingGodot] faction action: %s -> %s" % [
		str(_safe_dict(result.get("target_faction", {})).get("name", faction_id)),
		str(_safe_dict(result.get("action", {})).get("name", action_id))
	])
	_refresh_runtime_bar()

func _add_map_tab(tabs: TabContainer) -> void:
	world_map_panel = WorldMapPanelScript.new()
	world_map_panel.name = "天下图"
	world_map_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	world_map_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	world_map_panel.connect("region_edict_requested", Callable(self, "issue_selected_region_edict"))
	world_map_panel.connect("region_military_order_requested", Callable(self, "issue_selected_region_military_order"))
	tabs.add_child(world_map_panel)
	var runtime_map_data: Dictionary = game_state.call("map_view_data") if game_state != null and game_state.has_method("map_view_data") else {}
	world_map_panel.call("set_map_data", runtime_map_data)
	world_map_panel.call("select_region_by_index", 0)

func issue_selected_region_edict(edict_id: String) -> Dictionary:
	return _issue_selected_region_command("edict", edict_id)

func issue_selected_region_military_order(order_id: String) -> Dictionary:
	return _issue_selected_region_command("military_order", order_id)

func _issue_selected_region_command(command_type: String, command_id: String) -> Dictionary:
	if game_state == null:
		return {
			"ok": false,
			"error": "game state is not ready"
		}
	var region_id: String = _current_map_region_id()
	if region_id.is_empty():
		return {
			"ok": false,
			"error": "no selected region"
		}

	var result: Dictionary = {}
	match command_type:
		"edict":
			result = game_state.call("issue_edict", command_id, region_id)
		"military_order":
			result = game_state.call("issue_military_order", command_id, region_id)
		_:
			result = {
				"ok": false,
				"error": "unknown command type: %s" % command_type
			}

	if not bool(result.get("ok", false)):
		var message: String = str(result.get("error", "command failed"))
		if world_map_panel != null and world_map_panel.has_method("set_quick_status"):
			world_map_panel.call("set_quick_status", message)
		push_warning("map region command failed: %s" % message)
		return result

	var record: Dictionary = _safe_dict(result.get("record", {}))
	if world_map_panel != null and world_map_panel.has_method("set_quick_status"):
		var selected_region: Dictionary = _current_selected_map_region()
		world_map_panel.call("set_quick_status", "已执行：%s -> %s" % [
			str(record.get("name", command_id)),
			str(record.get("target_region", selected_region.get("name", region_id)))
		])
	_refresh_runtime_bar()
	return result

func _current_map_region_id() -> String:
	if world_map_panel == null or not world_map_panel.has_method("selected_region_runtime_id"):
		return ""
	return str(world_map_panel.call("selected_region_runtime_id"))

func _current_selected_map_region() -> Dictionary:
	if world_map_panel == null:
		return {}
	return _safe_dict(world_map_panel.get("selected_map_region"))

func _add_character_tab(tabs: TabContainer) -> void:
	character_browser_panel = CharacterBrowserPanelScript.new()
	character_browser_panel.name = "人物"
	character_browser_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	character_browser_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	character_browser_panel.connect("character_action_requested", Callable(self, "_on_character_action_requested"))
	tabs.add_child(character_browser_panel)
	var rows: Array = _safe_array(game_state.get("characters")) if game_state != null else []
	var action_rows: Array = game_state.call("character_actions") if game_state != null and game_state.has_method("character_actions") else []
	var history: Array = _safe_array(game_state.get("character_action_history")) if game_state != null else []
	var action_points: int = int(_num(game_state.get("action_points"))) if game_state != null else 0
	character_browser_panel.call("set_data", rows, action_rows, history, action_points)

func _on_character_action_requested(character_id: String, action_id: String) -> void:
	if game_state == null:
		return
	var result: Dictionary = game_state.call("perform_character_action", character_id, action_id)
	if not result.get("ok", false):
		push_warning("character action failed: %s" % str(result.get("error", "")))
		return
	print("[TianmingGodot] character action: %s -> %s" % [
		str(_safe_dict(result.get("character", {})).get("name", character_id)),
		str(_safe_dict(result.get("action", {})).get("name", action_id))
	])
	_refresh_runtime_bar()

func _safe_array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _safe_dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()
