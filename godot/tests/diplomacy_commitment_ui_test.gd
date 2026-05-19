extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/diplomacy_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the diplomacy panel")
		return
	if not panel.has_signal("diplomacy_commitment_renew_requested") or not panel.has_signal("diplomacy_commitment_break_requested"):
		_fail("Diplomacy panel does not expose commitment control signals")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	var target_id: String = _prepare_target_faction(game_state)
	if target_id.is_empty():
		_fail("No targetable faction was found")
		return
	var support_result: Dictionary = game_state.call("issue_diplomacy_action", "support_chahar", target_id)
	if not bool(support_result.get("ok", false)):
		_fail("Preparing support_chahar commitment failed: %s" % str(support_result.get("error", "")))
		return
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var action_points_before: int = int(game_state.get("action_points"))
	panel.emit_signal("diplomacy_commitment_renew_requested", "support_chahar", target_id)
	await get_tree().process_frame
	if int(game_state.get("action_points")) != action_points_before - 1:
		_fail("Commitment renewal UI request did not spend one action point")
		return
	var commitment: Dictionary = _dict(_array(game_state.get("active_diplomacy_commitments"))[0])
	if int(commitment.get("remaining_months", 0)) != 4:
		_fail("Commitment renewal UI request did not extend the commitment")
		return

	panel.emit_signal("diplomacy_commitment_break_requested", "support_chahar", target_id)
	await get_tree().process_frame
	if not _array(game_state.get("active_diplomacy_commitments")).is_empty():
		_fail("Commitment break UI request did not remove the commitment")
		return
	var target: Dictionary = _dict(game_state.call("faction_by_id", target_id))
	if int(target.get("ming_support", 0)) != 0:
		_fail("Commitment break UI request did not clear Ming support")
		return

	print("[TianmingGodotTest] diplomacy commitment UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _prepare_target_faction(state: RefCounted) -> String:
	var factions: Array = _array(state.get("factions")).duplicate(true)
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i]).duplicate(true)
		var id: String = str(faction.get("id", ""))
		if id.is_empty() or str(faction.get("name", "")).contains("明"):
			continue
		faction["relation_to_player"] = 45
		faction["hostility"] = 40
		faction.erase("ming_support")
		factions[i] = faction
		state.set("factions", factions)
		return id
	return ""

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] diplomacy commitment UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] diplomacy commitment UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
