extends Node

const MainScene := preload("res://scenes/main.tscn")

const REQUIRED_PANEL_SCRIPTS := [
	"res://scripts/gameplay_hub_panel.gd",
	"res://scripts/save_slot_panel.gd",
	"res://scripts/system_panel.gd",
	"res://scripts/court_action_panel.gd",
	"res://scripts/court_meeting_panel.gd",
	"res://scripts/edict_panel.gd",
	"res://scripts/military_order_panel.gd",
	"res://scripts/army_roster_panel.gd",
	"res://scripts/diplomacy_panel.gd",
	"res://scripts/appointment_panel.gd",
	"res://scripts/audience_panel.gd",
	"res://scripts/relationship_panel.gd",
	"res://scripts/faction_browser_panel.gd",
	"res://scripts/monthly_report_panel.gd",
	"res://scripts/chronicle_panel.gd",
	"res://scripts/communication_panel.gd",
	"res://scripts/event_queue_panel.gd",
	"res://scripts/world_map_panel.gd",
	"res://scripts/region_governance_panel.gd",
	"res://scripts/character_browser_panel.gd",
	"res://scripts/statecraft_panel.gd"
]

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	if main.has_method("_add_table_tab"):
		_fail("Main scene still exposes the legacy raw table tab builder")
		return
	var tabs: TabContainer = main.get("primary_tabs") as TabContainer
	if tabs == null:
		_fail("Main scene did not expose primary_tabs")
		return
	for script_path in REQUIRED_PANEL_SCRIPTS:
		var panel: Node = _find_node_with_script(main, script_path)
		if panel == null:
			_fail("Main scene missing panel script %s" % script_path)
			return
		if panel.get_parent() != tabs:
			_fail("%s is not a primary tab child" % script_path)
			return
	if tabs.get_child_count() != REQUIRED_PANEL_SCRIPTS.size():
		_fail("Primary tab count %d did not match panel count %d" % [tabs.get_child_count(), REQUIRED_PANEL_SCRIPTS.size()])
		return

	print("[TianmingGodotTest] main panelized tabs test passed")
	_finish(0)

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	print("[TianmingGodotTest] main panelized tabs test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] main panelized tabs test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
