extends Node

const CharacterDetailPanelScript := preload("res://scripts/character_detail_panel.gd")
const FactionDetailPanelScript := preload("res://scripts/faction_detail_panel.gd")

func _ready() -> void:
	if not await _verify_character_bio():
		return
	if not await _verify_faction_description():
		return

	print("[TianmingGodotTest] detail panel long-text scene test passed")
	_finish(0)

func _verify_character_bio() -> bool:
	var panel: Control = CharacterDetailPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var tail: String = "Character detail tail marker must remain visible."
	var bio: String = _long_text("Character biography", tail, 18)
	panel.call("set_character", {
		"id": "long_bio_character",
		"name": "Long Bio Character",
		"title": "Test Minister",
		"bio": bio,
	})
	await get_tree().process_frame

	var bio_label: Label = panel.get("bio_label") as Label
	if bio_label == null:
		_fail("Character detail panel did not expose bio label")
		return false
	if not bio_label.text.contains(tail):
		_fail("Character detail panel truncated biography tail")
		return false
	return true

func _verify_faction_description() -> bool:
	var panel: Control = FactionDetailPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var tail: String = "Faction description tail marker must remain visible."
	var description: String = _long_text("Faction strategic description", tail, 20)
	panel.call("set_faction", {
		"id": "long_desc_faction",
		"name": "Long Description Faction",
		"type": "test",
		"attitude": "neutral",
		"capital": "Test Capital",
		"leader": "Test Leader",
		"description": description,
	})
	await get_tree().process_frame

	var strategy_label: Label = panel.get("strategy_label") as Label
	if strategy_label == null:
		_fail("Faction detail panel did not expose strategy label")
		return false
	if not strategy_label.text.contains(tail):
		_fail("Faction detail panel truncated description tail")
		return false
	return true

func _long_text(prefix: String, tail: String, repeat_count: int) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for i in range(repeat_count):
		parts.append("%s segment %02d" % [prefix, i + 1])
	parts.append(tail)
	return " ".join(parts)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] detail panel long-text scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] detail panel long-text scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
