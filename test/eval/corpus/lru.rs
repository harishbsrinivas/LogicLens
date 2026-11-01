use std::collections::HashMap;
use std::hash::Hash;

/// Least-recently-used cache with a fixed capacity.
/// Entries live in a Vec used as a doubly linked list by index.
pub struct Lru<K, V> {
    map: HashMap<K, usize>,
    nodes: Vec<Node<K, V>>,
    head: Option<usize>,
    tail: Option<usize>,
    capacity: usize,
}

struct Node<K, V> {
    key: K,
    value: V,
    prev: Option<usize>,
    next: Option<usize>,
}

impl<K: Hash + Eq + Clone, V> Lru<K, V> {
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "capacity must be positive");
        Lru { map: HashMap::new(), nodes: Vec::with_capacity(capacity), head: None, tail: None, capacity }
    }

    pub fn get(&mut self, key: &K) -> Option<&V> {
        let index = *self.map.get(key)?;
        self.detach(index);
        self.push_front(index);
        Some(&self.nodes[index].value)
    }

    pub fn put(&mut self, key: K, value: V) {
        if let Some(&index) = self.map.get(&key) {
            self.nodes[index].value = value;
            self.detach(index);
            self.push_front(index);
            return;
        }
        let index = if self.nodes.len() < self.capacity {
            self.nodes.push(Node { key: key.clone(), value, prev: None, next: None });
            self.nodes.len() - 1
        } else {
            let lru = self.tail.expect("full cache has a tail");
            self.detach(lru);
            self.map.remove(&self.nodes[lru].key);
            self.nodes[lru] = Node { key: key.clone(), value, prev: None, next: None };
            lru
        };
        self.map.insert(key, index);
        self.push_front(index);
    }

    fn detach(&mut self, index: usize) {
        let (prev, next) = (self.nodes[index].prev, self.nodes[index].next);
        match prev { Some(p) => self.nodes[p].next = next, None => self.head = next }
        match next { Some(n) => self.nodes[n].prev = prev, None => self.tail = prev }
    }

    fn push_front(&mut self, index: usize) {
        self.nodes[index].prev = None;
        self.nodes[index].next = self.head;
        if let Some(h) = self.head { self.nodes[h].prev = Some(index); }
        self.head = Some(index);
        if self.tail.is_none() { self.tail = Some(index); }
    }
}
