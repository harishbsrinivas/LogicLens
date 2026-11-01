#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

/* Fixed-size byte ring buffer. One slot is kept empty to tell full from empty. */
typedef struct {
    unsigned char *data;
    size_t size;
    size_t head; /* next write */
    size_t tail; /* next read */
} ring_t;

bool ring_init(ring_t *r, size_t capacity) {
    r->data = malloc(capacity + 1);
    if (r->data == NULL) {
        return false;
    }
    r->size = capacity + 1;
    r->head = r->tail = 0;
    return true;
}

void ring_free(ring_t *r) {
    free(r->data);
    r->data = NULL;
}

size_t ring_used(const ring_t *r) {
    return (r->head + r->size - r->tail) % r->size;
}

size_t ring_free_space(const ring_t *r) {
    return r->size - 1 - ring_used(r);
}

size_t ring_write(ring_t *r, const void *src, size_t n) {
    const unsigned char *p = src;
    if (n > ring_free_space(r)) {
        n = ring_free_space(r);
    }
    size_t first = r->size - r->head;
    if (first > n) {
        first = n;
    }
    memcpy(r->data + r->head, p, first);
    memcpy(r->data, p + first, n - first);
    r->head = (r->head + n) % r->size;
    return n;
}

size_t ring_read(ring_t *r, void *dst, size_t n) {
    unsigned char *p = dst;
    if (n > ring_used(r)) {
        n = ring_used(r);
    }
    size_t first = r->size - r->tail;
    if (first > n) {
        first = n;
    }
    memcpy(p, r->data + r->tail, first);
    memcpy(p + first, r->data, n - first);
    r->tail = (r->tail + n) % r->size;
    return n;
}
