"""Small inventory model with reservations and a CSV import."""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from typing import Iterable


class OutOfStock(Exception):
    pass


@dataclass
class Item:
    sku: str
    name: str
    on_hand: int = 0
    reserved: int = 0

    @property
    def available(self) -> int:
        return self.on_hand - self.reserved


@dataclass
class Inventory:
    items: dict[str, Item] = field(default_factory=dict)

    def add(self, sku: str, name: str, quantity: int) -> Item:
        item = self.items.setdefault(sku, Item(sku, name))
        item.on_hand += quantity
        return item

    def reserve(self, sku: str, quantity: int) -> None:
        item = self.items.get(sku)
        if item is None or item.available < quantity:
            raise OutOfStock(sku)
        item.reserved += quantity

    def release(self, sku: str, quantity: int) -> None:
        item = self.items[sku]
        item.reserved = max(0, item.reserved - quantity)

    def ship(self, sku: str, quantity: int) -> None:
        item = self.items[sku]
        if item.reserved < quantity:
            raise ValueError("ship more than reserved")
        item.reserved -= quantity
        item.on_hand -= quantity


def load_csv(rows: Iterable[str]) -> Inventory:
    inventory = Inventory()
    for row in csv.DictReader(rows):
        inventory.add(row["sku"], row["name"], int(row.get("quantity") or 0))
    return inventory


if __name__ == "__main__":
    import sys

    with open(sys.argv[1], newline="") as f:
        inv = load_csv(f)
    for item in sorted(inv.items.values(), key=lambda i: i.sku):
        print(f"{item.sku}\t{item.available}")
