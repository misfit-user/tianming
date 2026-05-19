extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var edict_panel: Node = _find_node_with_script(main, "res://scripts/edict_panel.gd")
	var military_panel: Node = _find_node_with_script(main, "res://scripts/military_order_panel.gd")
	var diplomacy_panel: Node = _find_node_with_script(main, "res://scripts/diplomacy_panel.gd")
	if edict_panel == null or military_panel == null or diplomacy_panel == null:
		_fail("Main scene does not expose edict, military order, and diplomacy panels")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var removed_edict_id: String = str(edict_panel.get("selected_edict_id"))
	var removed_order_id: String = str(military_panel.get("selected_order_id"))
	var removed_diplomacy_id: String = str(diplomacy_panel.get("selected_action_id"))
	if removed_edict_id.is_empty() or removed_order_id.is_empty() or removed_diplomacy_id.is_empty():
		_fail("Command action panels did not select initial action templates")
		return

	var edicts: Array = _remove_row_by_id(_array(game_state.get("edict_templates")), removed_edict_id)
	var orders: Array = _remove_row_by_id(_array(game_state.get("military_order_templates")), removed_order_id)
	var diplomacy_actions: Array = _remove_row_by_id(_array(game_state.get("diplomacy_actions")), removed_diplomacy_id)
	if edicts.size() < 1 or orders.size() < 1 or diplomacy_actions.size() < 1:
		_fail("Command action selection recovery test requires replacement action templates")
		return
	game_state.set("edict_templates", edicts)
	game_state.set("military_order_templates", orders)
	game_state.set("diplomacy_actions", diplomacy_actions)

	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	if not _assert_recovered(edict_panel, "selected_edict_id", removed_edict_id, edicts, "Edict"):
		return
	if not _assert_recovered(military_panel, "selected_order_id", removed_order_id, orders, "Military order"):
		return
	if not _assert_recovered(diplomacy_panel, "selected_action_id", removed_diplomacy_id, diplomacy_actions, "Diplomacy"):
		return

	print("[TianmingGodotTest] command action selection recovery scene test passed")
	_finish(0)

func _remove_row_by_id(rows: Array, removed_id: String) -> Array:
	var result: Array = rows.duplicate(true)
	for i in range(result.size() - 1, -1, -1):
		if str(_dict(result[i]).get("id", "")) == removed_id:
			result.remove_at(i)
			break
	return result

func _assert_recovered(panel: Node, property_name: String, removed_id: String, rows: Array, label: String) -> bool:
	var recovered_id: String = str(panel.get(property_name))
	if recovered_id.is_empty() or recovered_id == removed_id:
		_fail("%s panel kept a stale selected action after runtime removal" % label)
		return false
	if _row_by_id(rows, recovered_id).is_empty():
		_fail("%s panel recovered to an action that is not in runtime state" % label)
		return false
	return true

func _row_by_id(rows: Array, id: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")) == id:
			return row
	return {}

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] command action selection recovery scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] command action selection recovery scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
