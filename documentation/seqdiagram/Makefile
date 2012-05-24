# Makefile for Sequence Diagrams
# Fernando Rodriguez Sela <frsela@tid.es>

P2P := pic2plot
SED := sed

.PHONY : all allpng allsvg clean

%.svg : %.pic
	$(P2P) -T "svg" $*.pic > $*.svg

%.png : %.pic
	$(P2P) -T "svg" $*.pic | convert -trim - $*.png

all: allpng allsvg

allpng:
	@for p in `find *.pic -maxdepth 0` ;\
        do \
          echo "Generating PNG from $$p" ;\
          if [ $$p = sequence.pic ]; \
                then \
                  echo "sequence.pic excluded ..." ;\
                else \
                  $(P2P) -T "svg" $$p | convert -trim - $$p.png ;\
                fi \
        done

allsvg:
	@for p in `find *.pic -maxdepth 0` ;\
        do \
          echo "Generating SVG from $$p" ;\
          if [ $$p = sequence.pic ]; \
                then \
                  echo "sequence.pic excluded ..." ;\
                else \
                  $(P2P) -T "svg" $$p > $$p.svg ;\
                fi \
        done

clean:
	@echo "Cleaning ..."
	rm -f *png
	rm -f *svg

